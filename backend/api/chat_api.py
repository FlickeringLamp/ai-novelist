import json
import logging
import time
import asyncio
from dataclasses import asdict
from pydantic import BaseModel, Field
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from backend.config.config import settings
from backend.ai_agent.core.graph_builder import with_graph_builder
from langchain_core.messages import HumanMessage
# 导入LangChain相关类型用于类型检查
from langgraph.types import Command

# 请求模型
class ChatMessageRequest(BaseModel):
    """发送聊天消息请求"""
    message: str = Field(..., description="用户消息内容")

class InterruptResponseRequest(BaseModel):
    """中断响应请求"""
    interrupt_id: str = Field(..., description="中断ID")
    choice: str = Field(..., description="用户选择 ('1'=恢复, '2'=取消)")
    additional_data: str = Field(default="", description="附加信息")

class SelectedModelRequest(BaseModel):
    """设置选中模型请求"""
    selectedModel: str = Field(..., description="选中的模型ID")
    selectedProvider: str = Field(..., description="选中的提供商ID")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/message", summary="发送聊天消息")
async def send_chat_message(request: ChatMessageRequest):
    """
    发送聊天消息给AI Agent
    
    - **message**: 用户消息内容
    """
    message = request.message
    thread_id = settings.get_config("thread_id")
    user_id = settings.get_config("user_id", default="default_user")
    logger.info(f"使用的thread_id: {thread_id}, user_id: {user_id}")
    
    @with_graph_builder
    async def generate_response(graph):
        """处理消息并返回生成器"""
        config = {"configurable": {"thread_id": thread_id, "user_id": user_id}}
        
        # 流式处理
        async for message_chunk, metadata in graph.astream({"messages": [HumanMessage(content=message)]}, config, stream_mode="messages"):
            # 在控制台打印流式传输信息
            if message_chunk.content:
                print(message_chunk.content, end="|", flush=True)
            
            # 使用model_dump方法序列化完整的消息对象
            serialized_chunk = message_chunk.model_dump()
            yield json.dumps(serialized_chunk, ensure_ascii=False)
            await asyncio.sleep(0)
        
        # 检查是否有工具中断
        final_state = await graph.aget_state(config)
        if hasattr(final_state, 'interrupts') and final_state.interrupts:
            logger.info(f"工具中断: {final_state}")
            for interrupt in final_state.interrupts:
                logger.info(f"中断信息: {interrupt.value}")
            
            # 发送中断信息
            interrupt_message = {
                "type": "interrupt",
                "interrupts": [asdict(interrupt) for interrupt in final_state.interrupts]
            }
            yield json.dumps(interrupt_message)
        
        # 发送完成标记
        done_message = {"type": "done"}
        yield json.dumps(done_message)
    
    return StreamingResponse(generate_response(), media_type="text/event-stream")


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
    thread_id = settings.get_config("thread_id")
    logger.info(f"收到中断响应: interrupt_id={interrupt_id}, choice={choice}, thread_id: {thread_id}")
    
    @with_graph_builder
    async def remove_interrupt_response(graph):
        """处理中断响应并返回生成器"""
        config = {"configurable": {"thread_id": thread_id}}
        
        # 构建中断响应
        human_response = Command(
            resume= {
                "choice_action": choice,
                "choice_data": additional_data
            }
        )
        
        # 流式处理中断响应
        async for message_chunk, metadata in graph.astream(human_response, config, stream_mode="messages"):
            print("message_chunk长什么样：", message_chunk)
            if message_chunk.content:
                print(message_chunk.content, end="/", flush=True)
            
            # 使用model_dump方法序列化完整的消息对象
            serialized_chunk = message_chunk.model_dump()
            yield json.dumps(serialized_chunk, ensure_ascii=False)
            await asyncio.sleep(0)
        
        # 再次检查有无工具中断
        final_state = await graph.aget_state(config)
        if hasattr(final_state, 'interrupts') and final_state.interrupts:
            logger.info(f"工具中断: {final_state}")
            for interrupt in final_state.interrupts:
                logger.info(f"中断信息: {interrupt.value}")
            
            # 发送中断信息
            interrupt_message = {
                "type": "interrupt",
                "interrupts": [asdict(interrupt) for interrupt in final_state.interrupts]
            }
            yield json.dumps(interrupt_message)
        
        # 发送完成标记
        done_message = {"type": "done"}
        yield json.dumps(done_message)
    
    return StreamingResponse(remove_interrupt_response(), media_type="text/event-stream")


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
    # 从配置文件获取thread_id
    thread_id = settings.get_config("thread_id")
    logger.info(f"总结对话使用的thread_id: {thread_id}")
    
    # 使用装饰器创建图操作函数
    @with_graph_builder
    async def process_summarize(graph):
        """处理总结对话"""
        config = {"configurable": {"thread_id": thread_id}}
        
        # 获取当前状态
        current_state = await graph.aget_state(config)
        current_messages = current_state.values.get("messages", [])
        
        # 打印完整消息内容用于调试
        logger.info(f"总结前的消息数量: {len(current_messages)}")
        for i, msg in enumerate(current_messages):
            logger.info(f"消息 {i}: 完整内容={msg}")
        
        if not current_messages:
            return ""
        
        # 使用总结指令触发总结（直接传入消息列表，使用operator.add自动追加）
        summarize_instruction = HumanMessage(content="/summarize")
        
        # 调用图处理总结指令（直接传入消息列表，使用operator.add自动追加）
        async for _ in graph.astream([summarize_instruction], config):
            pass
        
        # 获取更新后的消息
        updated_state = await graph.aget_state(config)
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
    
    # 调用装饰器函数
    return await process_summarize()


@router.get("/selected-model", summary="获取选中的模型")
async def get_selected_model():
    """
    获取当前选中的模型和提供商
    
    返回:
    - selectedModel: 选中的模型ID
    - selectedProvider: 选中的提供商ID
    """
    selected_model = settings.get_config("selectedModel", default="")
    selected_provider = settings.get_config("selectedProvider", default="")
    
    logger.info(f"获取选中的模型: {selected_model}, 提供商: {selected_provider}")
    
    return {
        "selectedModel": selected_model,
        "selectedProvider": selected_provider
    }


@router.post("/selected-model", summary="设置选中的模型")
async def set_selected_model(request: SelectedModelRequest):
    """
    设置选中的模型和提供商
    
    - **selectedModel**: 选中的模型ID
    - **selectedProvider**: 选中的提供商ID
    
    返回:
    - success: 是否成功
    """
    settings.update_config(request.selectedModel, "selectedModel")
    settings.update_config(request.selectedProvider, "selectedProvider")
    
    logger.info(f"设置选中的模型: {request.selectedModel}, 提供商: {request.selectedProvider}")
    
    return {
        "success": True,
        "selectedModel": request.selectedModel,
        "selectedProvider": request.selectedProvider
    }
