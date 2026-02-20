import json
import logging
import time
import asyncio
from pydantic import BaseModel, Field
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from backend.config.config import settings
from backend.ai_agent.core.graph_builder import with_graph_builder
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
# 导入LangChain相关类型用于类型检查
from langgraph.types import Command

def serialize_messages_with_type(messages):
    """为消息添加type字段"""
    result = []
    for msg in messages:
        msg_dict = msg.model_dump() if hasattr(msg, 'model_dump') else {}
        
        # 根据消息类型添加type字段
        if isinstance(msg, HumanMessage):
            msg_dict['type'] = 'human'
        elif isinstance(msg, AIMessage):
            msg_dict['type'] = 'ai'
        elif isinstance(msg, ToolMessage):
            msg_dict['type'] = 'tool'
        else:
            msg_dict['type'] = 'unknown'
        
        result.append(msg_dict)
    return result

# 请求模型
class ChatMessageRequest(BaseModel):
    """发送聊天消息请求"""
    message: str = Field(..., description="用户消息内容")
    id: str = Field(default="", description="消息ID")

class InterruptResponseRequest(BaseModel):
    """中断响应请求"""
    interrupt_id: str = Field(..., description="中断ID")
    choice: str = Field(..., description="用户选择 ('1'=恢复, '2'=取消)")
    additional_data: str = Field(default="", description="附加信息")

class NewThreadRequest(BaseModel):
    """创建新会话请求"""
    thread_id: str = Field(..., description="新的thread_id")

class SelectedModelRequest(BaseModel):
    """设置选中模型请求"""
    selectedModel: str = Field(..., description="选中的模型ID")
    selectedProvider: str = Field(..., description="选中的提供商ID")

class AutoApproveSettingsRequest(BaseModel):
    """设置自动批准配置请求"""
    enabled: bool = Field(..., description="是否启用自动批准")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/message", summary="发送聊天消息")
async def send_chat_message(request: ChatMessageRequest):
    """
    发送聊天消息给AI Agent
    
    - **message**: 用户消息内容
    - **id**: 消息ID
    """
    message = request.message
    message_id = request.id
    thread_id = settings.get_config("thread_id")
    user_id = settings.get_config("user_id", default="default_user")
    logger.info(f"使用的thread_id: {thread_id}, user_id: {user_id}, message_id: {message_id}")
    
    @with_graph_builder
    async def generate_response(graph):
        """处理消息并返回生成器"""
        config = {"configurable": {"thread_id": thread_id, "user_id": user_id}}
        
        # 构造HumanMessage，包含id
        human_message = HumanMessage(content=message, id=message_id)
        
        # 流式处理
        async for message_chunk, metadata in graph.astream({"messages": [human_message]}, config, stream_mode="messages"):
            # 在控制台打印流式传输信息
            if message_chunk.content:
                print(message_chunk.content, end="|", flush=True)
            
            # 使用model_dump方法序列化完整的消息对象
            # 添加分隔符，避免被多个json对象被拼接到一起，进而造成前端消息显示不全，隔三岔五缺几个字符的问题
            serialized_chunk = message_chunk.model_dump()
            print("流式消息：",serialized_chunk)
            yield json.dumps(serialized_chunk, ensure_ascii=False) + "\n"
            await asyncio.sleep(0)
    
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
            if message_chunk.content:
                print(message_chunk.content, end="/", flush=True)
            
            # 使用model_dump方法序列化完整的消息对象
            serialized_chunk = message_chunk.model_dump()
            yield json.dumps(serialized_chunk, ensure_ascii=False) + "\n"
            await asyncio.sleep(0)
    
    return StreamingResponse(remove_interrupt_response(), media_type="text/event-stream")


@router.post("/update-thread", summary="更新会话")
async def update_thread(request: NewThreadRequest):
    """
    保存前端传来的thread_id
    
    - **thread_id**: 前端生成的thread_id
    """
    # 保存到配置文件
    settings.update_config(request.thread_id, "thread_id")
    
    logger.info(f"保存新的thread_id: {request.thread_id}")
    
    return {"success": True, "thread_id": request.thread_id}


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

@router.get("/state", summary="获取当前状态")
async def get_current_state():
    """
    获取当前对话的完整状态
    
    返回:
    - 完整的state对象，包含values、next、config、metadata等
    """
    thread_id = settings.get_config("thread_id")
    user_id = settings.get_config("user_id", default="default_user")
    logger.info(f"获取状态使用的thread_id: {thread_id}, user_id: {user_id}")
    
    @with_graph_builder
    async def process_get_state(graph):
        """获取当前状态"""
        config = {"configurable": {"thread_id": thread_id, "user_id": user_id}}
        
        # 获取最终状态
        final_state = await graph.aget_state(config)
        
        # 处理values中的messages，添加type字段
        values = final_state.values if hasattr(final_state, 'values') else {}
        if 'messages' in values:
            values = {**values, 'messages': serialize_messages_with_type(values['messages'])}
        
        # 手动构建可序列化的state字典
        state_dict = {
            "values": values,
            "next": final_state.next if hasattr(final_state, 'next') else None,
            "config": final_state.config if hasattr(final_state, 'config') else {},
            "metadata": final_state.metadata if hasattr(final_state, 'metadata') else {},
            "created_at": final_state.created_at if hasattr(final_state, 'created_at') else None,
            "parent_config": final_state.parent_config if hasattr(final_state, 'parent_config') else None,
            "tasks": list(final_state.tasks) if hasattr(final_state, 'tasks') else [],
            "interrupts": list(final_state.interrupts) if hasattr(final_state, 'interrupts') else []
        }
        
        return state_dict
    
    # 使用async for遍历生成器并获取结果
    result = None
    async for item in process_get_state():
        result = item
    return result


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


@router.get("/auto-approve", summary="获取自动批准配置")
async def get_auto_approve():
    """
    获取自动批准配置
    
    返回:
    - enabled: 是否启用自动批准
    """
    enabled = settings.get_config("autoApproveSettings", default=False)
    
    logger.info(f"获取自动批准配置: enabled={enabled}")
    
    return {
        "enabled": enabled
    }


@router.post("/auto-approve", summary="设置自动批准配置")
async def set_auto_approve(request: AutoApproveSettingsRequest):
    """
    设置自动批准配置
    
    - **enabled**: 是否启用自动批准
    
    返回:
    - success: 是否成功
    - enabled: 设置后的启用状态
    """
    settings.update_config(request.enabled, "autoApproveSettings")
    
    logger.info(f"设置自动批准配置: enabled={request.enabled}")
    
    return {
        "success": True,
        "enabled": request.enabled
    }
