"""
AI聊天API模块
为前端提供AI聊天、工具调用等功能的RESTful API
专注于聊天交互和流式响应
"""

import json
import logging
import base64
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator

from backend.ai_agent.config import ai_settings
from backend.ai_agent.core.graph_builder import build_graph
from backend.ai_agent.core.tool_load import import_tools_from_directory
from backend.ai_agent.core.system_prompt_builder import system_prompt_builder

# 导入LangChain相关类型用于类型检查
from langgraph.types import StateSnapshot, Interrupt
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
LANGCHAIN_IMPORTS_AVAILABLE = True

logger = logging.getLogger(__name__)

# 自定义JSON序列化器，用于处理LangChain消息对象
def serialize_langchain_object(obj):
    """序列化LangChain对象为JSON可序列化的格式"""
    try:
        result = {}
        
        # 处理Stream对象 - 优先处理，避免后续尝试调用model_dump()
        if hasattr(obj, '__class__') and obj.__class__.__name__ == 'Stream':
            return {
                'type': 'stream',
                'content': str(obj),
                'class_name': obj.__class__.__name__
            }
        
        # 处理StateSnapshot对象 - 这是主要的返回对象
        if LANGCHAIN_IMPORTS_AVAILABLE and isinstance(obj, StateSnapshot):
            result.update({
                'type': 'state_snapshot',
                'values': serialize_langchain_object(getattr(obj, 'values', {})),
                'next': getattr(obj, 'next', None),
                'config': getattr(obj, 'config', {}),
                'metadata': getattr(obj, 'metadata', {}),
                'created_at': getattr(obj, 'created_at', None),
                'parent_config': getattr(obj, 'parent_config', None),
                'tasks': serialize_langchain_object(getattr(obj, 'tasks', [])),
                'interrupts': serialize_langchain_object(getattr(obj, 'interrupts', [])),
            })
        
        # 处理各种消息类型
        if LANGCHAIN_IMPORTS_AVAILABLE and isinstance(obj, (SystemMessage, HumanMessage, AIMessage, ToolMessage)):
            message_data = {
                'type': obj.__class__.__name__.lower(),
                'content': getattr(obj, 'content', ''),
                'additional_kwargs': serialize_langchain_object(getattr(obj, 'additional_kwargs', {})),
                'response_metadata': serialize_langchain_object(getattr(obj, 'response_metadata', {})),
                'id': getattr(obj, 'id', '')
            }
            
            # 处理AIMessage特有的字段
            if isinstance(obj, AIMessage):
                message_data.update({
                    'tool_calls': serialize_langchain_object(getattr(obj, 'tool_calls', [])),
                    'usage_metadata': serialize_langchain_object(getattr(obj, 'usage_metadata', {})),
                    'refusal': getattr(obj, 'refusal', None)
                })
            
            # 处理ToolMessage特有的字段
            if isinstance(obj, ToolMessage):
                message_data.update({
                    'tool_call_id': getattr(obj, 'tool_call_id', '')
                })
            
            result.update(message_data)
        
        # 处理Interrupt对象
        if LANGCHAIN_IMPORTS_AVAILABLE and isinstance(obj, Interrupt):
            result.update({
                'type': 'interrupt',
                'value': getattr(obj, 'value', ''),
                'id': getattr(obj, 'id', '')
            })
        
        # 处理PregelTask对象（使用字符串检查作为备用）
        if hasattr(obj, '__class__') and obj.__class__.__name__ == 'PregelTask':
            result.update({
                'type': 'pregel_task',
                'id': getattr(obj, 'id', ''),
                'name': getattr(obj, 'name', ''),
                'path': serialize_langchain_object(getattr(obj, 'path', ())),
                'error': getattr(obj, 'error', None),
                'interrupts': serialize_langchain_object(getattr(obj, 'interrupts', ())),
                'state': getattr(obj, 'state', None),
                'result': getattr(obj, 'result', None)
            })
        
        # 如果已经处理了特定类型，直接返回结果
        if result:
            return result
        
        # 处理字典、列表、元组等基础数据结构
        if isinstance(obj, dict):
            return {k: serialize_langchain_object(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [serialize_langchain_object(item) for item in obj]
        elif isinstance(obj, tuple):
            return [serialize_langchain_object(item) for item in obj]
        elif isinstance(obj, (str, int, float, bool, type(None))):
            # 基础类型直接返回
            return obj
        else:
            # 对于其他无法序列化的对象，尝试获取其属性
            try:
                # 检查是否有model_dump方法（Pydantic模型）
                if hasattr(obj, 'model_dump') and callable(getattr(obj, 'model_dump')):
                    return serialize_langchain_object(obj.model_dump())
                # 尝试获取对象的可序列化属性
                elif hasattr(obj, '__dict__'):
                    return serialize_langchain_object(obj.__dict__)
                else:
                    # 最后尝试字符串表示
                    return str(obj)
            except Exception as inner_e:
                logger.warning(f"Fallback serialization failed for {type(obj)}: {inner_e}")
                return repr(obj)
    except Exception as e:
        logger.error(f"Serialization error for object {type(obj)}: {e}")
        return {"type": "serialization_error", "error": str(e)}
router = APIRouter(prefix="/api/chat", tags=["AI Chat"])

# 全局工具实例
tools = None

def initialize_tools(mode: str = None):
    """初始化工具
    
    Args:
        mode: 模式名称，如果提供则只加载该模式启用的工具
    """
    global tools
    try:
        tools = import_tools_from_directory('tool', mode)
        if mode:
            logger.info(f"Tools initialized for mode '{mode}': {len(tools)} tools loaded")
        else:
            logger.info(f"Tools initialized: {len(tools)} tools loaded")
    except Exception as e:
        logger.error(f"Failed to initialize tools: {e}")
        raise

def create_graph(mode: str = None):
    """创建新的图实例
    
    Args:
        mode: 模式名称，如果提供则只加载该模式启用的工具
    """
    try:
        # 根据模式加载工具
        tools = import_tools_from_directory('tool', mode)
        
        # 构建图实例，使用统一的数据库连接管理
        from langgraph.checkpoint.sqlite import SqliteSaver
        from .history_api import get_db_connection
        
        memory = SqliteSaver(get_db_connection())
        
        # 使用 SystemPromptBuilder 构建完整的系统提示词
        import asyncio
        try:
            # 尝试获取当前运行的事件循环
            loop = asyncio.get_running_loop()
            # 如果成功获取，说明已有运行中的循环，使用 nest_asyncio
            import nest_asyncio
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
    except Exception as e:
        logger.error(f"Failed to create graph: {e}")
        raise

# 数据模型
class ChatMessageRequest(BaseModel):
    """聊天消息请求模型"""
    message: str
    
    @validator('message')
    def validate_message(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('消息不能为空')
        return v

class InterruptResponseRequest(BaseModel):
    """中断响应请求模型"""
    interrupt_id: str
    choice: str  # '1'=恢复, '2'=取消
    additional_data: str = ""

# API端点
# API端点
@router.post("/message", summary="发送聊天消息")
async def send_chat_message(request: ChatMessageRequest):
    """
    发送聊天消息给AI Agent
    
    - **message**: 用户消息内容
    """
    try:
        # 从配置文件获取当前模式和thread_id
        current_mode = ai_settings.CURRENT_MODE
        thread_id = ai_settings.get_thread_id()
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
                updated_messages = current_messages + [HumanMessage(content=request.message)]
               
                # 创建输入状态
                from ai_agent.config import State
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
                
            except Exception as e:
                logger.error(f"Stream generation error: {e}")
                error_data = {'error': str(e)}
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
            
    except Exception as e:
        logger.error(f"Chat message processing error: {e}")
        raise HTTPException(status_code=500, detail=f"处理聊天消息时出错: {str(e)}")

@router.post("/interrupt-response", summary="解除中断")
async def send_interrupt_response(request: InterruptResponseRequest):
    """
    发送中断响应给AI Agent继续处理
    
    - **interrupt_id**: 中断ID
    - **choice**: 用户选择 ('1'=恢复, '2'=取消)
    - **additional_data**: 附加信息
    """
    try:
        # 从配置文件获取thread_id
        thread_id = ai_settings.get_thread_id()
        logger.info(f"收到中断响应: interrupt_id={request.interrupt_id}, choice={request.choice}, thread_id: {thread_id}")
        
        # 每次请求都创建新的graph实例，确保使用最新的模型配置和工具
        # 从配置文件读取当前模式
        current_mode = ai_settings.CURRENT_MODE
        logger.info(f"中断响应使用的模式配置: {current_mode}")
        graph = create_graph(current_mode)
        
        # 构建中断响应
        from langgraph.types import Command
        human_response = Command(
            resume= {
                "choice_action": request.choice,
                "choice_data": request.additional_data
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
                
            except Exception as e:
                logger.error(f"Interrupt response stream error: {e}")
                error_data = {'error': str(e)}
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
        
    except Exception as e:
        logger.error(f"Interrupt response processing error: {e}")
        raise HTTPException(status_code=500, detail=f"处理中断响应时出错: {str(e)}")

@router.post("/new-thread", summary="创建新的会话")
async def create_new_thread():
    """
    创建新的thread_id并返回
    
    返回:
    - 新的thread_id
    """
    try:
        # 创建基于时间戳的新thread_id
        import time
        new_thread_id = f"thread_{int(time.time() * 1000)}"
        
        # 保存到配置文件
        ai_settings.save_config("thread_id", new_thread_id)
        
        logger.info(f"创建新的thread_id: {new_thread_id}")
        
        return {
            "success": True,
            "thread_id": new_thread_id,
            "message": "新会话创建成功"
        }
    except Exception as e:
        logger.error(f"创建新thread_id失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建新会话失败: {str(e)}")

@router.get("/current-thread", summary="获取当前会话ID")
async def get_current_thread():
    """
    获取当前的thread_id
    
    返回:
    - 当前的thread_id
    """
    try:
        # 从配置文件获取当前的thread_id
        current_thread_id = ai_settings.get_thread_id()
        
        logger.info(f"获取当前thread_id: {current_thread_id}")
        
        return {
            "success": True,
            "thread_id": current_thread_id,
            "message": "获取当前会话ID成功"
        }
    except Exception as e:
        logger.error(f"获取当前thread_id失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取当前会话ID失败: {str(e)}")

@router.post("/summarize", summary="总结对话")
async def summarize_conversation():
    """
    总结当前对话历史
    
    返回:
    - 对话总结内容
    """
    try:
        # 从配置文件获取当前模式和thread_id
        current_mode = ai_settings.CURRENT_MODE
        thread_id = ai_settings.get_thread_id()
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
            return {
                "success": False,
                "summary": "",
                "message": "没有可总结的对话历史"
            }
        
        # 使用总结指令触发总结（与主循环相同的方式）
        from langchain_core.messages import HumanMessage
        summarize_instruction = HumanMessage(content="/summarize")
        updated_messages = current_messages + [summarize_instruction]
        
        # 创建输入状态
        from ai_agent.config import State
        input_state = State(messages=updated_messages)
        
        # 调用图处理总结指令
        result = graph.invoke(input_state, config)
        
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
        
        return {
            "success": True,
            "summary": updated_summary,
            "message": "对话总结成功"
        }
        
    except Exception as e:
        logger.error(f"总结对话失败: {e}")
        raise HTTPException(status_code=500, detail=f"总结对话失败: {str(e)}")


# 初始化工具
initialize_tools()
