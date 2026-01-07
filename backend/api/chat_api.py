import json
import logging
import base64
import time
import asyncio
import nest_asyncio
from pydantic import BaseModel, Field
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from backend.config import State
from backend.config import settings
from backend.core.ai_agent.core.graph_builder import build_graph
from backend.core.ai_agent.core.tool_load import import_tools_from_directory
from backend.core.ai_agent.core.system_prompt_builder import system_prompt_builder
from backend.core.ai_agent.utils.db_utils import get_db_connection
from backend.core.ai_agent.utils.serialize_langchain_obj import serialize_langchain_object
# 导入LangChain相关类型用于类型检查
from langgraph.types import Command
from langgraph.checkpoint.sqlite import SqliteSaver
LANGCHAIN_IMPORTS_AVAILABLE = True

# 请求模型
class ChatMessageRequest(BaseModel):
    """发送聊天消息请求"""
    message: str = Field(..., description="用户消息内容")

class InterruptResponseRequest(BaseModel):
    """中断响应请求"""
    interrupt_id: str = Field(..., description="中断ID")
    choice: str = Field(..., description="用户选择 ('1'=恢复, '2'=取消)")
    additional_data: str = Field(default="", description="附加信息")

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/chat", tags=["AI Chat"])


def create_graph(mode: str = None):
    """创建新的图实例
    
    Args:
        mode: 模式名称，如果提供则只加载该模式启用的工具
    """
    # 根据模式加载工具
    tools = import_tools_from_directory('tool', mode)
    
    # 构建图实例，使用统一的数据库连接管理
    memory = SqliteSaver(get_db_connection())
    
    # 使用 SystemPromptBuilder 构建完整的系统提示词
    try:
        # 尝试获取当前运行的事件循环
        loop = asyncio.get_running_loop()
        # 如果成功获取，说明已有运行中的循环，使用 nest_asyncio
        nest_asyncio.apply()
        current_prompt = loop.run_until_complete(
            system_prompt_builder.build_system_prompt(mode=mode, include_persistent_memory=True)
        )
    except RuntimeError:
        # 没有运行中的循环，可以安全创建新循环
        current_prompt = asyncio.run(system_prompt_builder.build_system_prompt(mode=mode, include_persistent_memory=True))
    
    graph = build_graph(tools, memory, system_prompt=current_prompt, mode=mode)
    
    logger.info(f"Graph created successfully for mode '{mode}': {len(tools)} tools bound")
    return graph

# API端点
@router.post("/message", summary="发送聊天消息")
async def send_chat_message(request: ChatMessageRequest):
    """
    发送聊天消息给AI Agent
    
    - **message**: 用户消息内容
    """
    message = request.message
    # 从配置文件获取当前模式和thread_id
    current_mode = settings.get_config("currentMode", "outline")
    thread_id = settings.get_config("thread_id")
    logger.info(f"使用的模式配置: {current_mode}, thread_id: {thread_id}")
    
    # 每次请求都创建新的graph实例，确保使用最新的模型配置和工具
    graph = create_graph(current_mode)
    
    # 流式响应
    async def generate():
        try:
            config = {"configurable": {"thread_id": thread_id}}
            # 获取当前状态
            current_state = graph.get_state(config)
            current_messages = current_state.values.get("messages", [])
           
            # 打印调试信息
            logger.info(f"发送消息前的消息数量: {len(current_messages)}")
            for i, msg in enumerate(current_messages):
                logger.info(f"发送消息前 {i}: 完整内容={msg}")
           
            # 添加用户消息
            from langchain_core.messages import HumanMessage
            updated_messages = current_messages + [HumanMessage(content=message)]
           
            # 创建输入状态
            input_state = State(messages=updated_messages)
            
            # 流式处理
            for message_chunk, metadata in graph.stream(input_state, config, stream_mode="messages"):
                # 在控制台打印流式传输信息
                if message_chunk.content:
                    print(message_chunk.content, end="|", flush=True)
                
                # 序列化消息块对象，处理LangChain消息
                serialized_chunk = serialize_langchain_object(message_chunk)
                # 使用Base64编码避免JSON解析问题
                json_str = json.dumps(serialized_chunk, ensure_ascii=False)
                encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                
                # 关键修复：强制刷新缓冲区，确保数据立即发送
                yield f"data: {encoded_data}\n\n"
                await asyncio.sleep(0)  # 强制让出控制权，确保数据立即发送
            
            # 获取最终状态检查是否有工具中断
            final_state = graph.get_state(config)
            
            # 检查是否有工具中断，如果有则发送中断信息给前端
            if hasattr(final_state, 'interrupts') and final_state.interrupts:
                logger.info(f"工具中断: {final_state}")
                for interrupt in final_state.interrupts:
                    logger.info(f"中断信息: {interrupt.value}")
                
                # 发送中断信息给前端
                interrupt_data = {
                    'type': 'interrupt',
                    'interrupts': serialize_langchain_object(final_state.interrupts),
                    'state': serialize_langchain_object(final_state)
                }
                # 使用Base64编码避免JSON解析问题
                json_str = json.dumps(interrupt_data, ensure_ascii=False)
                encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                yield f"data: {encoded_data}\n\n"
            
            # 发送完成标记
            done_data = {'type': 'done'}
            json_str = json.dumps(done_data, ensure_ascii=False)
            encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
            yield f"data: {encoded_data}\n\n"
            
        except Exception as stream_err:
            logger.error(f"Stream generation error: {stream_err}")
            error_data = {'error': str(stream_err)}
            json_str = json.dumps(error_data, ensure_ascii=False)
            encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
            yield f"data: {encoded_data}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用Nginx缓冲
        }
    )

@router.post("/interrupt-response", summary="解除中断")
async def send_interrupt_response(request: InterruptResponseRequest):
    """
    发送中断响应给AI Agent继续处理
    
    - **interrupt_id**: 中断ID
    - **choice**: 用户选择 ('1'=恢复, '2'=取消)
    - **additional_data**: 附加信息
    """
    interrupt_id = request.interrupt_id
    choice = request.choice
    additional_data = request.additional_data
    # 从配置文件获取thread_id
    thread_id = settings.get_config("thread_id")
    logger.info(f"收到中断响应: interrupt_id={interrupt_id}, choice={choice}, thread_id: {thread_id}")
    
    # 每次请求都创建新的graph实例，确保使用最新的模型配置和工具
    # 从配置文件读取当前模式
    current_mode = settings.get_config("currentMode", "outline")
    logger.info(f"中断响应使用的模式配置: {current_mode}")
    graph = create_graph(current_mode)
    
    # 构建中断响应
    human_response = Command(
        resume= {
            "choice_action": choice,
            "choice_data": additional_data
        }
    )
    config = {"configurable": {"thread_id": thread_id}}
    
    # 流式处理中断响应
    async def generate_interrupt_response():
        try:
            for message_chunk, metadata in graph.stream(human_response, config, stream_mode="messages"):
                # 序列化消息块对象，处理LangChain消息
                serialized_chunk = serialize_langchain_object(message_chunk)
                # 使用Base64编码避免JSON解析问题
                json_str = json.dumps(serialized_chunk, ensure_ascii=False)
                encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                
                # 关键修复：强制刷新缓冲区，确保数据立即发送
                yield f"data: {encoded_data}\n\n"
                await asyncio.sleep(0)  # 强制让出控制权，确保数据立即发送
            
            # 获取最终状态检查是否有再次中断
            final_state = graph.get_state(config)
            
            # 检查是否有再次中断，如果有则发送中断信息给前端
            if hasattr(final_state, 'interrupts') and final_state.interrupts:
                logger.info(f"工具中断: {final_state}")
                for interrupt in final_state.interrupts:
                    logger.info(f"中断信息: {interrupt.value}")
                
                # 发送中断信息给前端
                interrupt_data = {
                    'type': 'interrupt',
                    'interrupts': serialize_langchain_object(final_state.interrupts),
                    'state': serialize_langchain_object(final_state)
                }
                # 使用Base64编码避免JSON解析问题
                json_str = json.dumps(interrupt_data, ensure_ascii=False)
                encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                yield f"data: {encoded_data}\n\n"
            
            # 发送完成标记
            done_data = {'type': 'done'}
            json_str = json.dumps(done_data, ensure_ascii=False)
            encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
            yield f"data: {encoded_data}\n\n"
            
        except Exception as interrupt_err:
            logger.error(f"Interrupt response stream error: {interrupt_err}")
            error_data = {'error': str(interrupt_err)}
            json_str = json.dumps(error_data, ensure_ascii=False)
            encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
            yield f"data: {encoded_data}\n\n"
    
    return StreamingResponse(
        generate_interrupt_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用Nginx缓冲
        }
    )

@router.post("/new-thread", summary="创建新的会话", response_model=str)
async def create_new_thread():
    """
    创建新的thread_id并返回
    
    返回:
    - 新的thread_id
    """
    # 创建基于时间戳的新thread_id
    new_thread_id = f"thread_{int(time.time() * 1000)}"
    
    # 保存到配置文件
    settings.update_config({"thread_id": new_thread_id})
    
    logger.info(f"创建新的thread_id: {new_thread_id}")
    
    return new_thread_id

@router.get("/current-thread", summary="获取当前会话ID", response_model=str)
async def get_current_thread():
    """
    获取当前的thread_id
    
    返回:
    - 当前的thread_id
    """
    # 从配置文件获取当前的thread_id
    current_thread_id = settings.get_config("thread_id")
    
    logger.info(f"获取当前thread_id: {current_thread_id}")
    
    return current_thread_id

@router.post("/summarize", summary="总结对话", response_model=str)
async def summarize_conversation():
    """
    总结当前对话历史
    
    返回:
    - 对话总结内容
    """
    # 从配置文件获取当前模式和thread_id
    current_mode = settings.get_config("currentMode", "outline")
    thread_id = settings.get_config("thread_id")
    logger.info(f"总结对话使用的模式配置: {current_mode}, thread_id: {thread_id}")
    
    # 创建图实例
    graph = create_graph(current_mode)
    config = {"configurable": {"thread_id": thread_id}}
    
    # 获取当前状态
    current_state = graph.get_state(config)
    current_messages = current_state.values.get("messages", [])
    
    # 打印完整消息内容用于调试
    logger.info(f"总结前的消息数量: {len(current_messages)}")
    for i, msg in enumerate(current_messages):
        logger.info(f"消息 {i}: 完整内容={msg}")
    
    if not current_messages:
        return ""
    
    # 使用总结指令触发总结（与主循环相同的方式）
    from langchain_core.messages import HumanMessage
    summarize_instruction = HumanMessage(content="/summarize")
    updated_messages = current_messages + [summarize_instruction]
    
    # 创建输入状态
    input_state = State(messages=updated_messages)
    
    # 调用图处理总结指令,后续可能使用result=graph.invoke()来获取更新后的消息
    graph.invoke(input_state, config)
    
    # 获取更新后的消息
    updated_state = graph.get_state(config)
    updated_messages_after = updated_state.values.get("messages", [])
    
    # 从最后一条消息中获取总结内容
    updated_summary = ""
    if updated_messages_after:
        last_message = updated_messages_after[-1]
        if hasattr(last_message, 'content'):
            updated_summary = last_message.content
    
    # 打印总结后的完整消息内容
    logger.info(f"对话总结完成，总结长度: {len(updated_summary)}")
    logger.info(f"总结后的消息数量: {len(updated_messages_after)}:完整内容={updated_messages_after}")
    
    return updated_summary