from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import tools_condition
from langgraph.store.sqlite.aio import AsyncSqliteStore
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langchain_core.messages import ToolMessage, SystemMessage, HumanMessage, RemoveMessage
from langchain_core.messages.utils import (
    trim_messages,
    count_tokens_approximately
)
from typing import Callable, Any
from backend.config.config import settings
from backend.ai_agent.models.multi_model_adapter import MultiModelAdapter
from backend.ai_agent.core.tool_load import import_tools_from_directory
from backend.ai_agent.core.system_prompt_builder import SystemPromptBuilder
import uuid


class State(MessagesState):
    """包含消息的状态,不包括系统提示词"""
    summary: str


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
        # 从配置文件获取当前模式
        mode = settings.get_config("currentMode", default="outline")

        # 根据模式加载工具
        tool_dict = import_tools_from_directory('tool', mode)

        # 每次都创建新的store实例，避免线程冲突
        store_db_path = str(settings.DB_DIR) + "/store.db"
        store = AsyncSqliteStore.from_conn_string(store_db_path)

        # 使用 SystemPromptBuilder 构建完整的系统提示词（每次创建新实例避免并发问题）
        prompt_builder = SystemPromptBuilder()

        print(f"[INFO] 构建图实例 - 模式: {mode}, 工具数量: {len(tool_dict)}")
        # 从配置中获取当前选择的模型和提供商
        selected_model = settings.get_config("selectedModel")
        selected_provider = settings.get_config("selectedProvider")
        temperature = settings.get_config("mode", mode, "temperature")
        max_tokens = settings.get_config("mode", mode, "max_tokens")

        print(f"构建图实例 - 模型: {selected_model}, 提供商: {selected_provider}, 模式: {mode}")

        # 使用多模型适配器创建模型实例,max_tokens不传，让提供商使用默认的**单轮回复**最大输出长度
        llm = MultiModelAdapter.create_model(
            model = selected_model,
            provider = selected_provider,
            temperature = temperature,
            timeout = 300,
        )

        # 统一使用bind_tools绑定工具
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
            timeout = 300,
        )
        # 不绑定工具，确保AI不会尝试调用工具
        summarization_model = llm_summarization

        # 创建工具名称映射
        tools_by_name = {tool.name: tool for tool in tool_dict.values()}

        # 创建模型节点
        async def call_llm(state: State, config):
            """调用LLM生成响应"""
            # 打印完整state，包括summary字段
            print(f"[STATE] 完整state: {state}")
            
            # 获取当前消息列表
            current_messages = state["messages"]
            
            # 获取用户输入（最后一条消息）
            user_input = None
            if current_messages:
                last_message = current_messages[-1]
                if hasattr(last_message, 'content'):
                    user_input = str(last_message.content)
            
            # 获取过往消息总结
            summary = state.get("summary", "")
            
            # 异步获取系统提示词，传入用户输入用于RAG检索和过往消息总结
            system_prompt = await prompt_builder.build_system_prompt(mode=mode, user_input=user_input, summary=summary)
            
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
            print("max_tokens:",max_tokens)
            
            # 调用模型生成响应
            print("发送给ai的信息：",[SystemMessage(content=enhanced_system_prompt)] + current_messages)
            
            # 统一调用方式
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

        # 自定义工具节点（0.3的预构建组件在1.0教程并未提及，故按照langgraph官方文档，手动处理tool_node）
        async def tool_node(state: State):
            """执行工具调用"""
            result = []
            # 处理最后一条消息中的工具调用
            for tool_call in state["messages"][-1].tool_calls:
                tool = tools_by_name[tool_call["name"]]
                observation = await tool.ainvoke(tool_call["args"])
                result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
            
            print(f"看看长什么样，是否有自动生成ToolMessage: {result}")
            # 直接返回result，使用operator.add自动追加到状态中
            return {"messages": result}

        # 创建总结节点，使用官方1.0推荐的总结机制
        async def summarize_conversation(state: State):
            """总结对话历史，使用LangGraph 1.0官方推荐的方式"""
            # 首先，我们获取任何现有摘要
            summary = state.get("summary", "")

            # 创建我们的摘要提示
            if summary:
                # 已经存在摘要，扩展摘要
                summary_message = (
                    f"This is a summary of the conversation to date: {summary}\n\n"
                    "Extend the summary by taking into account the new messages above:"
                )
            else:
                # 创建新的摘要
                summary_message = "Create a summary of the conversation above:"

            # 将提示添加到我们的历史记录中
            messages = state["messages"] + [HumanMessage(content=summary_message)]
            
            print(f"[DEBUG] summarize节点 - 准备调用总结模型，消息数量: {len(messages)}")
            # 调用总结模型
            response = await summarization_model.ainvoke(messages)
            
            print(f"[DEBUG] summarize节点 - 总结模型返回: '{response.content}'")
            
            # 只保留倒数第2条消息，删除其他所有消息
            delete_messages = [RemoveMessage(id=m.id) for m in state["messages"][:-2]] + [RemoveMessage(id=state["messages"][-1].id)]
            
            # 返回新的摘要和要删除的消息
            return {"summary": response.content, "messages": delete_messages}

        # 构建图
        builder = StateGraph(State)

        # 添加节点
        builder.add_node("call_llm", call_llm)
        builder.add_node("tools", tool_node)  # 使用自定义工具节点函数
        builder.add_node("summarize", summarize_conversation)  # 添加总结节点

        # 定义路由函数：根据用户输入决定进入哪个节点
        def route_based_on_input(state: State):
            """根据用户输入决定路由"""
            # 获取最后一条消息
            messages = state["messages"]
            if not messages:
                return "call_llm"
            
            last_message = messages[-1]
            if hasattr(last_message, 'content'):
                content = str(last_message.content).strip()
                # 检查是否是总结指令
                if content == "@summarize":
                    return "summarize"
            
            return "call_llm"

        # 添加边
        builder.add_conditional_edges(
            START,
            route_based_on_input,
            {
                "call_llm": "call_llm",
                "summarize": "summarize"
            }
        )
        builder.add_edge("tools", "call_llm")
        builder.add_conditional_edges(
            "call_llm",
            tools_condition,
        )
        # 总结节点执行后结束，避免触发后续节点
        builder.add_edge("summarize", END)

        # 创建SQLite检查点数据库路径
        checkpoint_db_path = str(settings.DB_DIR) + "/checkpoints.db"
        
        # 使用异步上下文管理器创建checkpointer和store
        async with AsyncSqliteSaver.from_conn_string(checkpoint_db_path) as checkpointer, \
                    AsyncSqliteStore.from_conn_string(store_db_path) as store:
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
