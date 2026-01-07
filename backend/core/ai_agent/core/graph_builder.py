from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import tools_condition
from langchain_core.messages import ToolMessage, AIMessage, SystemMessage, HumanMessage
from langchain_core.messages.utils import (
    trim_messages,
    count_tokens_approximately
)
from typing import TypedDict
from backend.config import settings
from backend.core.ai_agent.models.multi_model_adapter import MultiModelAdapter


class State(TypedDict):
    """包含消息的状态"""
    messages: list
def build_graph(tool_dict, memory, system_prompt=None, mode=None):
    """构建并返回图实例
    
    Args:
        tool_dict: 工具字典
        memory: 记忆存储
        system_prompt: 系统提示词
        mode: 模式名称，用于工具过滤
    """
    # 从配置中获取当前选择的模型和提供商
    selected_model = settings.get_config("selectedModel", "deepseek-chat")
    selected_provider = settings.get_config("selectedProvider", "deepseek")
    
    # 如果模型ID包含提供商信息（如 "zhipuai/glm-4-plus"），则解析提供商和模型名称
    if "/" in selected_model:
        # 从模型ID中解析提供商和模型名称
        provider_from_model, model_name = selected_model.split("/", 1)
        selected_provider = provider_from_model
        selected_model = model_name
    
    print(f"构建图实例 - 模型: {selected_model}, 提供商: {selected_provider}, 模式: {mode}")
    
    # 使用多模型适配器创建模型实例
    llm = MultiModelAdapter.create_model(
        model=selected_model,
        provider=selected_provider,
        temperature=settings.temperature, # 这里要重构，不应在config里写死0.7，而是从配置文件获取
        max_tokens=settings.max_tokens, # 同样要重构
        timeout=300,
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
        model=selected_model,
        provider=selected_provider,
        temperature=settings.temperature, # 同
        max_tokens=4096,  # 限制token数
        timeout=300,
    )
    # 不绑定工具，确保AI不会尝试调用工具
    summarization_model = llm_summarization
    # 创建模型节点
    def call_llm(state: State):
        """调用LLM生成响应"""
        # 获取当前消息列表
        current_messages = state["messages"]
        print(f"当前消息列表{current_messages}")
        
        # 获取模式特定的最大token数
        ai_parameters = settings.get_config("aiParameters", {})
        mode_parameters = ai_parameters.get(mode, {})
        mode_max_tokens = mode_parameters.get("max_tokens", 4096)
        print(f"最大tokens数被设置为{mode_max_tokens}")
        # 修剪消息历史，避免超出上下文限制，不填 include_system默认裁掉系统提示词
        current_messages = trim_messages(
            current_messages,
            strategy="last",  # 保留最新的消息
            token_counter=count_tokens_approximately,
            max_tokens=mode_max_tokens,
            start_on="human",  # 从human消息开始保留
            end_on=("human", "tool"),  # 在human或tool消息结束
        )
        
        # 调用模型生成响应
        response = llm_with_tools.invoke([SystemMessage(content=system_prompt)] + current_messages)
        print(f"response长什么样{response}")
        # 手动将新消息添加到现有消息列表中
        updated_messages = current_messages + [response]
        print(f"添加后的消息，看看是否有自动生成AIMessage： {updated_messages}")
        return {"messages": updated_messages}
    tools_by_name = {tool.name: tool for tool in tool_dict.values()}

    # 自定义工具节点（0.3的预构建组件在1.0教程并未提及，故按照langgraph官方文档，手动处理tool_node）
    def tool_node(state: State):
        """执行工具调用"""
        # 获取当前消息列表
        current_messages = state.get("messages", [])
        
        result = []
        # 处理最后一条消息中的工具调用
        for tool_call in state["messages"][-1].tool_calls:
            tool = tools_by_name[tool_call["name"]]
            observation = tool.invoke(tool_call["args"])
            result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
        

        updated_messages = current_messages + result
        print(f"看看长什么样，是否有自动生成ToolMessage: {updated_messages}")
        return {"messages": updated_messages}

    # 准备换用官方1.0推荐的删除机制
    def custom_delete_messages(state: State):
        """自定义删除消息节点 - 完全手动管理消息删除"""
        messages = state["messages"]
        
        # 检查是否有删除指令
        delete_instructions = []
        remaining_messages = []
        
        for msg in messages:
            # 检查是否是删除指令消息
            if isinstance(msg, HumanMessage) and msg.content.startswith("/delete"):
                delete_instructions.append(msg)
            elif isinstance(msg, AIMessage) and hasattr(msg, 'content') and msg.content and msg.content.startswith("删除"):
                delete_instructions.append(msg)
            else:
                remaining_messages.append(msg)
        
        # 如果有删除指令，执行删除逻辑
        if delete_instructions:
            print(f"检测到删除指令，执行删除操作...")
            
            # 分析删除指令类型
            for instruction in delete_instructions:
                content = instruction.content
                
                # 删除所有消息
                if "/delete all" in content.lower() or "删除所有" in content:
                    print("执行清空所有消息操作")
                    remaining_messages = []  # 清空所有消息
                    break
                
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
                        
                        if 0 <= index < len(remaining_messages):
                            print(f"删除索引 {index} 的消息")
                            remaining_messages.pop(index)
                    except (ValueError, IndexError):
                        print("删除索引无效")
            
            print(f"删除操作完成，剩余 {len(remaining_messages)} 条消息")
        
        return {"messages": remaining_messages}

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
        
        # 返回用户消息+AI总结消息，符合裁剪规则
        result = {
            "messages": [summary_user_message, summary_ai_message]
        }
        print(f"[DEBUG] summarize节点 - 返回结果: {result}")
        return result
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
    # 编译图时使用SQLite检查点
    graph = builder.compile(checkpointer=memory)
    
    return graph