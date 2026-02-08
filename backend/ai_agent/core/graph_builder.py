from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import tools_condition
from langgraph.store.base import BaseStore
from langgraph.store.sqlite import SqliteStore
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langchain_core.messages import AnyMessage, ToolMessage, AIMessage, SystemMessage, HumanMessage, RemoveMessage
from langchain_core.messages.utils import (
    trim_messages,
    count_tokens_approximately
)
from typing_extensions import TypedDict, Annotated
from typing import Callable, Any
import operator
from backend.config.config import settings
from backend.ai_agent.models.multi_model_adapter import MultiModelAdapter
from backend.ai_agent.core.tool_load import import_tools_from_directory
from backend.ai_agent.core.system_prompt_builder import SystemPromptBuilder
import uuid
import asyncio


class State(TypedDict):
    """包含消息的状态,不包括系统提示词"""
    messages: Annotated[list[AnyMessage], operator.add]


# 从配置文件获取当前模式
mode = settings.get_config("currentMode", default="outline")

# 根据模式加载工具
tool_dict = import_tools_from_directory('tool', mode)

# 每次都创建新的store实例，避免线程冲突
store_db_path = str(settings.DB_DIR) + "/store.db"
store = SqliteStore.from_conn_string(store_db_path)

# 使用 SystemPromptBuilder 构建完整的系统提示词（每次创建新实例避免并发问题）
prompt_builder = SystemPromptBuilder()
# system_prompt 将在 call_llm 函数中异步获取，避免模块级别的 await

print(f"[INFO] 构建图实例 - 模式: {mode}, 工具数量: {len(tool_dict)}")
# 从配置中获取当前选择的模型和提供商
selected_model = settings.get_config("selectedModel")
selected_provider = settings.get_config("selectedProvider")
temperature = settings.get_config("mode", mode, "temperature")
max_tokens = settings.get_config("mode", mode, "max_tokens")

# 如果模型ID包含提供商信息（如 "zhipuai/glm-4-plus"），则解析提供商和模型名称
if "/" in selected_model:
    # 从模型ID中解析提供商和模型名称
    provider_from_model, model_name = selected_model.split("/", 1)
    selected_provider = provider_from_model
    selected_model = model_name

print(f"构建图实例 - 模型: {selected_model}, 提供商: {selected_provider}, 模式: {mode}")

# 使用多模型适配器创建模型实例
llm = MultiModelAdapter.create_model(
    model = selected_model,
    provider = selected_provider,
    temperature = temperature,
    max_tokens = max_tokens,
    timeout = 300,
)

# 绑定工具到模型
if tool_dict:
    llm_with_tools = llm.bind_tools(list(tool_dict.values()))
    print(f"[INFO] 已绑定 {len(tool_dict)} 个工具到模型")
else:
    llm_with_tools = llm
    print(f"[WARNING] 没有可用的工具绑定到模型")

# 创建独立的总结模型实例（不绑定工具）
llm_summarization = MultiModelAdapter.create_model(
    model = selected_model,
    provider = selected_provider,
    temperature = temperature,
    max_tokens = 4096,
    timeout = 300,
)
# 不绑定工具，确保AI不会尝试调用工具
summarization_model = llm_summarization

# 创建模型节点
async def call_llm(state: State, config):
    """调用LLM生成响应"""
    # 获取当前消息列表
    current_messages = state["messages"]
    print(f"当前消息列表{current_messages}")
    
    # 异步获取系统提示词
    system_prompt = await prompt_builder.build_system_prompt(mode=mode, include_persistent_memory=True)
    
    # 如果有store可用，检索长期记忆
    memory_context = ""
    if store is not None:
        try:
            # 从config中获取user_id
            user_id = config.get("configurable", {}).get("user_id", "default")
            namespace = ("memories", user_id)
            
            # 搜索相关记忆
            last_message = current_messages[-1] if current_messages else None
            if last_message:
                query = str(last_message.content) if hasattr(last_message, 'content') else ""
                if query:
                    memories = store.search(namespace, query=query, limit=5)
                    if memories:
                        memory_context = "\n".join([d.value.get("data", "") for d in memories])
                        print(f"[MEMORY] 检索到 {len(memories)} 条记忆")
        except Exception as e:
            print(f"[MEMORY] 检索记忆时出错: {e}")
    
    # 将记忆上下文添加到系统提示词
    enhanced_system_prompt = system_prompt
    if memory_context:
        enhanced_system_prompt = f"{system_prompt}\n\n【长期记忆】\n{memory_context}"
    
    # 修剪消息历史，避免超出上下文限制，include_system不填，默认去除提示词
    current_messages = trim_messages(
        current_messages,
        strategy="last",  # 保留最新的消息
        token_counter=count_tokens_approximately,
        max_tokens=max_tokens,
        start_on="human",  # 从human消息开始保留
        end_on=("human", "tool"),  # 在human或tool消息结束
    )
    
    # 调用模型生成响应
    print("发送给ai的信息：",[SystemMessage(content=enhanced_system_prompt)] + current_messages)
    response = await llm_with_tools.ainvoke([SystemMessage(content=enhanced_system_prompt)] + current_messages)
    print(f"response长什么样{response}")
    
    # 检测用户是否要求记住某些信息，并存储到长期记忆
    if store is not None and current_messages:
        try:
            last_message = current_messages[-1]
            if hasattr(last_message, 'content') and last_message.content:
                content = last_message.content.lower()
                # 检测记住指令
                if "记住" in content or "remember" in content or "记录" in content:
                    user_id = config.get("configurable", {}).get("user_id", "default")
                    namespace = ("memories", user_id)
                    # 提取需要记住的内容（简单实现，可以根据需要改进）
                    memory_content = last_message.content
                    # 存储记忆
                    memory_id = str(uuid.uuid4())
                    store.put(namespace, memory_id, {"data": memory_content})
                    print(f"[MEMORY] 已存储记忆: {memory_id}")
        except Exception as e:
            print(f"[MEMORY] 存储记忆时出错: {e}")
    
    # 直接返回response，使用operator.add自动追加到状态中
    return {"messages": [response]}
tools_by_name = {tool.name: tool for tool in tool_dict.values()}

# 自定义工具节点（0.3的预构建组件在1.0教程并未提及，故按照langgraph官方文档，手动处理tool_node）
def tool_node(state: State):
    """执行工具调用"""
    result = []
    # 处理最后一条消息中的工具调用
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])
        result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
    
    print(f"看看长什么样，是否有自动生成ToolMessage: {result}")
    # 直接返回result，使用operator.add自动追加到状态中
    return {"messages": result}

# 准备换用官方1.0推荐的删除机制
def custom_delete_messages(state: State):
    """自定义删除消息节点 - 使用RemoveMessage删除消息"""
    messages = state["messages"]
    
    # 检查是否有删除指令
    delete_instructions = []
    
    for msg in messages:
        # 检查是否是删除指令消息
        if isinstance(msg, HumanMessage) and msg.content.startswith("/delete"):
            delete_instructions.append(msg)
        elif isinstance(msg, AIMessage) and hasattr(msg, 'content') and msg.content and msg.content.startswith("删除"):
            delete_instructions.append(msg)
    
    # 如果有删除指令，执行删除逻辑
    if delete_instructions:
        print(f"检测到删除指令，执行删除操作...")
        
        # 分析删除指令类型
        for instruction in delete_instructions:
            content = instruction.content
            
            # 删除所有消息
            if "/delete all" in content.lower() or "删除所有" in content:
                print("执行清空所有消息操作")
                # 使用RemoveMessage删除所有消息
                return {"messages": [RemoveMessage(id=m.id) for m in messages]}
            
            # 删除特定索引的消息
            elif "/delete index" in content.lower() or "删除索引" in content:
                try:
                    import re
                    match = re.search(r'/delete\s+index\s+(\d+)', content.lower())
                    if match:
                        index = int(match.group(1))
                    else:
                        match = re.search(r'删除索引\s*(\d+)', content)
                        index = int(match.group(1)) if match else -1
                    
                    if 0 <= index < len(messages):
                        print(f"删除索引 {index} 的消息")
                        return {"messages": [RemoveMessage(id=messages[index].id)]}
                except (ValueError, IndexError):
                    print("删除索引无效")
        
        print(f"删除操作完成")

# 创建总结节点，准备换用官方1.0推荐的总结机制，同时应该取消手动添加消息状态的机制
def summarize_conversation(state: State):
    """总结对话历史"""
    # 设置总结节点的系统提示词
    summary_system_prompt = "你是一个对话总结助手，请阅读上述对话，总结重点信息"
    
    # 创建消息列表，包含系统提示词
    messages = [SystemMessage(content=summary_system_prompt)]

    # 添加原始消息
    messages.extend(state["messages"])
    
    # 添加总结提示
    messages.append(HumanMessage(content="请为上面的对话创建一个总结:"))
    
    print(f"[DEBUG] summarize节点 - 准备调用总结模型，消息数量: {len(messages)}")
    # 调用总结模型
    response = summarization_model.invoke(messages)
    
    print(f"[DEBUG] summarize节点 - 总结模型返回: '{response.content}'")
    # 创建包含总结内容的AI消息
    summary_ai_message = AIMessage(content=response.content)
    
    # 创建用户消息，用于触发总结
    summary_user_message = HumanMessage(content="请总结上述对话，保留重点信息")
    
    # 直接返回消息列表，使用operator.add自动追加到状态中
    print(f"[DEBUG] summarize节点 - 返回结果")
    return {"messages": [summary_user_message, summary_ai_message]}


builder = StateGraph(State)

# 添加节点
builder.add_node("call_llm", call_llm)
builder.add_node("tools", tool_node)  # 使用自定义工具节点函数
builder.add_node("custom_delete", custom_delete_messages)  # 使用自定义删除节点
builder.add_node("summarize", summarize_conversation)  # 添加总结节点

# 条件判断函数 - 决定是执行删除操作、总结操作还是调用LLM
def route_to_delete_or_llm(state: State):
    """路由到删除节点、总结节点或LLM节点"""
    messages = state["messages"]
    
    # 检查是否有删除指令
    has_delete_instructions = False
    has_summarize_instructions = False
    
    # 打印所有消息内容用于调试
    print(f"[DEBUG] 路由函数检查消息，共 {len(messages)} 条消息:")
    for i, msg in enumerate(messages):
        print(f"[DEBUG] 消息 {i}: 类型={type(msg).__name__}, 内容前50字符={str(msg.content)[:50] if hasattr(msg, 'content') else '无内容'}")
    
    for msg in messages:
        if isinstance(msg, HumanMessage):
            if msg.content.startswith("/delete"):
                has_delete_instructions = True
                print(f"[DEBUG] 检测到删除指令: {msg.content}")
                break
            elif msg.content.startswith("/summarize"):
                has_summarize_instructions = True
                print(f"[DEBUG] 检测到总结指令: {msg.content}")
                break
    
    if has_delete_instructions:
        # 如果有删除指令，执行删除
        print(f"[DEBUG] 路由决策: 执行删除操作")
        return "custom_delete"
    elif has_summarize_instructions:
        # 如果有总结指令，执行总结
        print(f"[DEBUG] 路由决策: 执行总结操作")
        return "summarize"
    else:
        # 否则调用LLM
        print(f"[DEBUG] 路由决策: 调用LLM")
        return "call_llm"

# 添加边
builder.add_edge("tools", "call_llm")
builder.add_conditional_edges(
    "call_llm",
    tools_condition,
)
# 添加从START到删除节点的条件边
builder.add_conditional_edges(
    START,
    route_to_delete_or_llm,
    {
        "custom_delete": "custom_delete",
        "summarize": "summarize",
        "call_llm": "call_llm"
    }
)
# 总结节点执行后结束，避免触发后续节点
builder.add_edge("summarize", END)

# 删除节点执行后结束
builder.add_edge("custom_delete", END)


def with_graph_builder(func: Callable[[Any], Any]) -> Callable[[Any], Any]:
    """
    图构建装饰器函数，用于接收外界传入的操作函数
    
    Args:
        func: 外界传入的操作函数，接收编译后的图作为参数
             可以是普通异步函数或异步生成器函数
        
    Returns:
        包装后的异步函数或异步生成器函数
    """
    async def wrapper(*args, **kwargs):
        # 创建SQLite检查点数据库路径
        checkpoint_db_path = str(settings.DB_DIR) + "/checkpoints.db"
        
        # 使用异步上下文管理器创建checkpointer
        async with AsyncSqliteSaver.from_conn_string(checkpoint_db_path) as checkpointer:
            # 编译图，使用checkpointer和store（长期记忆）
            compiled_graph = builder.compile(checkpointer=checkpointer, store=store)
            
            # 调用外界传入的函数，传入编译后的图
            result = func(compiled_graph, *args, **kwargs)
            
            # 检查是否是异步生成器
            if hasattr(result, '__aiter__'):
                # 如果是异步生成器，遍历并 yield
                async for item in result:
                    yield item
            else:
                # 如果是普通异步函数，await 并返回结果
                result = await result
                # 对于异步生成器函数，我们不能使用 return，所以将结果包装为单个元素的生成器
                yield result
    
    return wrapper
