import logging
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