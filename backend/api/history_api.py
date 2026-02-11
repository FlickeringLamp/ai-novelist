import logging
import sqlite3
import os
import msgpack
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from langchain_core.runnables.config import RunnableConfig
from langchain_core.messages import HumanMessage

from backend.config.config import settings
from backend.ai_agent.core.graph_builder import with_graph_builder
from backend.config.config import get_db_connection
import time

logger = logging.getLogger(__name__)
db_path = settings.CHECKPOINTS_DB_PATH

# 请求模型
class GetCheckpointsRequest(BaseModel):
    """获取存档点列表请求"""
    thread_id: str = Field(default="default", description="会话ID")
    mode: str = Field(default="outline", description="对话模式 (outline/writing/adjustment)")

class RollbackCheckpointRequest(BaseModel):
    """回档到指定存档点请求"""
    thread_id: str = Field(default="default", description="会话ID")
    checkpoint_index: int = Field(default=0, description="存档点索引")
    new_message: str = Field(default="", description="新的用户消息内容")
    mode: str = Field(default="outline", description="对话模式")

class GetMessagesRequest(BaseModel):
    """获取历史消息列表请求"""
    thread_id: str = Field(default="default", description="会话ID")
    mode: str = Field(default="outline", description="对话模式")

class OperateMessagesRequest(BaseModel):
    """操作历史消息请求"""
    thread_id: str = Field(default="default", description="会话ID")
    operation_type: str = Field(default="", description="操作类型 ('delete_all', 'delete_index', 'delete_ids')")
    target_indices: Optional[List[int]] = Field(default=None, description="目标索引列表（用于delete_index操作）")
    target_ids: Optional[List[str]] = Field(default=None, description="目标ID列表（用于delete_ids操作）")
    mode: str = Field(default="outline", description="对话模式")

# 创建API路由器
router = APIRouter(prefix="/api/history", tags=["History"])

# API端点

@router.post("/checkpoints", summary="获取存档点列表", response_model=List[Dict[str, Any]])
async def get_checkpoints(request: GetCheckpointsRequest):
    """
    获取指定会话的所有存档点列表
    
    - **thread_id**: 会话ID
    - **mode**: 对话模式 (outline/writing/adjustment)
    """
    thread_id = request.thread_id
    
    # 使用装饰器创建图操作函数
    @with_graph_builder
    async def process_get_checkpoints(graph):
        """处理获取存档点列表"""
        config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
        
        # 获取存档点历史
        states = []
        async for state in graph.aget_state_history(config):
            states.append(state)
        
        checkpoints = []
        for index, state in enumerate(states):
            # 获取检查点ID
            checkpoint_id = state.config.get('configurable', {}).get('checkpoint_id', 'unknown')
            
            # 获取最后一条消息内容
            messages = state.values.get("messages", [])
            last_message_type = "unknown"
            last_message_content = ""
            tool_calls = None
            
            if messages:
                last_message = messages[-1]
                last_message_type = last_message.type if hasattr(last_message, 'type') else 'unknown'
                last_message_content = last_message.content if hasattr(last_message, 'content') else str(last_message)
                
                # 如果是工具调用，显示工具信息
                if last_message_type == 'ai' and hasattr(last_message, 'tool_calls') and last_message.tool_calls:
                    tool_names = [tc.get('name', 'unknown') for tc in last_message.tool_calls]
                    tool_calls = tool_names
                    last_message_content = f"工具调用: {', '.join(tool_names)}"
            
            checkpoint_info = {
                "checkpoint_id": checkpoint_id,
                "index": index,
                "next_node": state.next,
                "last_message_type": last_message_type,
                "last_message_content": last_message_content,
                "tool_calls": tool_calls
            }
            checkpoints.append(checkpoint_info)
        
        return checkpoints
    
    # 调用装饰器函数
    return await process_get_checkpoints()

@router.post("/checkpoint/rollback", summary="回档到指定存档点", response_model=Dict[str, Any])
async def rollback_to_checkpoint(request: RollbackCheckpointRequest):
    """
    回档到指定存档点并继续对话
    
    - **thread_id**: 会话ID
    - **checkpoint_index**: 存档点索引
    - **new_message**: 新的用户消息内容
    - **mode**: 对话模式
    """
    thread_id = request.thread_id
    checkpoint_index = request.checkpoint_index
    new_message = request.new_message
    
    # 使用装饰器创建图操作函数
    @with_graph_builder
    async def process_rollback(graph):
        """处理回档操作"""
        config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
        
        # 获取存档点历史
        states = []
        async for state in graph.aget_state_history(config):
            states.append(state)
        
        if checkpoint_index < 0 or checkpoint_index >= len(states):
            raise HTTPException(status_code=400, detail="存档点索引无效")
        
        # 获取选中的存档点
        selected_state = states[checkpoint_index]
        
        # 更新状态：获取整个消息列表，去掉最后一条用户信息，添加新的用户消息
        current_messages = selected_state.values.get("messages", [])
        
        # 如果消息列表为空，直接添加新消息
        if not current_messages:
            new_messages = [HumanMessage(content=new_message)]
        else:
            # 检查最后一条消息是否是用户消息
            last_message = current_messages[-1]
            if hasattr(last_message, 'type') and last_message.type == 'human':
                # 如果最后一条是用户消息，替换它
                new_messages = current_messages[:-1] + [HumanMessage(content=new_message)]
            else:
                # 如果最后一条不是用户消息，直接添加新消息
                new_messages = current_messages + [HumanMessage(content=new_message)]
        
        # 用整个新状态替换原本的旧状态
        new_config = await graph.aupdate_state(selected_state.config, values={"messages": new_messages})
        
        # 触发回复（直接传入消息列表，使用operator.add自动追加）
        # 执行对话（使用astream异步流式处理）
        result = None
        async for chunk in graph.astream(new_messages, new_config):
            if result is None:
                result = chunk
            else:
                # 合并结果
                result.update(chunk)
        
        return {
            "new_config": new_config,
            "result": serialize_langchain_object(result)
        }
    
    # 调用装饰器函数
    return await process_rollback()

@router.post("/messages", summary="获取历史消息列表", response_model=List[Dict[str, Any]])
async def get_messages(request: GetMessagesRequest):
    """
    获取指定会话的所有历史消息列表
    
    - **thread_id**: 会话ID
    - **mode**: 对话模式
    """
    thread_id = request.thread_id
    
    # 使用装饰器创建图操作函数
    @with_graph_builder
    async def process_get_messages(graph):
        """处理获取历史消息列表"""
        config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
        
        # 获取当前状态
        current_state = await graph.aget_state(config)
        current_messages = current_state.values.get("messages", [])
        
        messages = []
        for index, msg in enumerate(current_messages):
            message_info = {
                "index": index,
                "message_id": getattr(msg, 'id', f"msg_{index}") or f"msg_{index}",
                "message_type": msg.type if hasattr(msg, 'type') else 'unknown',
                "content": msg.content if hasattr(msg, 'content') else str(msg),
                "tool_calls": getattr(msg, 'tool_calls', None)
            }
            messages.append(message_info)
        
        return messages
    
    # 调用装饰器函数
    return await process_get_messages()

@router.post("/messages/operation", summary="操作历史消息", response_model=Dict[str, Any])
async def operate_messages(request: OperateMessagesRequest):
    """
    对历史消息进行操作（删除等）
    
    - **thread_id**: 会话ID
    - **operation_type**: 操作类型 ('delete_all', 'delete_index', 'delete_ids')
    - **target_indices**: 目标索引列表（用于delete_index操作）
    - **target_ids**: 目标ID列表（用于delete_ids操作）
    - **mode**: 对话模式
    """
    thread_id = request.thread_id
    operation_type = request.operation_type
    target_indices = request.target_indices
    target_ids = request.target_ids
    
    # 使用装饰器创建图操作函数
    @with_graph_builder
    async def process_operate_messages(graph):
        """处理操作历史消息"""
        config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
        
        # 获取当前状态
        current_state = await graph.aget_state(config)
        current_messages = current_state.values.get("messages", [])
        
        if operation_type == 'delete_all':
            # 删除所有消息（直接传入消息列表，使用operator.add自动追加）
            delete_instruction = HumanMessage(content="/delete all")
            
            # 调用图，条件边会自动路由到自定义删除节点（使用astream异步流式处理）
            result = None
            async for chunk in graph.astream(
                [delete_instruction],
                config
            ):
                if result is None:
                    result = chunk
                else:
                    result.update(chunk)
            
            return {"result": serialize_langchain_object(result)}
            
        elif operation_type == 'delete_index' and target_indices:
            # 删除指定索引的消息
            result = None
            for index in target_indices:
                if 0 <= index < len(current_messages):
                    # 使用自定义删除指令删除特定索引的消息（直接传入消息列表，使用operator.add自动追加）
                    delete_instruction = HumanMessage(content=f"/delete index {index}")
                    
                    # 调用图，条件边会自动路由到自定义删除节点（使用astream异步流式处理）
                    chunk_result = None
                    async for chunk in graph.astream(
                        [delete_instruction],
                        config
                    ):
                        if chunk_result is None:
                            chunk_result = chunk
                        else:
                            chunk_result.update(chunk)
                    result = chunk_result
                    current_messages = result["messages"]
                else:
                    logger.warning(f"无效的消息索引: {index}")
            
            return {"result": serialize_langchain_object(result)}
            
        elif operation_type == 'delete_ids' and target_ids:
            # 删除指定ID的消息
            deleted_count = 0
            result = None
            for msg_id in target_ids:
                # 查找消息索引
                for index, msg in enumerate(current_messages):
                    if getattr(msg, 'id', None) == msg_id:
                        # 使用自定义删除指令删除特定索引的消息（直接传入消息列表，使用operator.add自动追加）
                        delete_instruction = HumanMessage(content=f"/delete index {index}")
                        
                        # 调用图，条件边会自动路由到自定义删除节点（使用astream异步流式处理）
                        chunk_result = None
                        async for chunk in graph.astream(
                            [delete_instruction],
                            config
                        ):
                            if chunk_result is None:
                                chunk_result = chunk
                            else:
                                chunk_result.update(chunk)
                        result = chunk_result
                        current_messages = result["messages"]
                        deleted_count += 1
                        break
            
            if result is None:
                result = {"messages": current_messages}
            return {"result": serialize_langchain_object(result)}
        
        else:
            raise HTTPException(status_code=400, detail="无效的操作类型或参数")
    
    # 调用装饰器函数
    return await process_operate_messages()

# 会话管理API端点
@router.get("/sessions", summary="获取所有会话列表", response_model=Dict[str, Any])
async def get_all_sessions():
    """
    获取所有会话的列表
    
    返回所有用户的会话信息，包括会话ID、消息数量等
    """
    
    if not os.path.exists(db_path):
        return {"sessions": []}
    
    # 使用全局连接，避免锁定问题
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 检查checkpoints表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='checkpoints'")
    if cursor.fetchone() is None:
        return {"sessions": []}
    
    # 获取所有用户ID（会话ID）并按照最后访问时间排序
    cursor.execute('''
        SELECT DISTINCT thread_id,
               (SELECT MAX(checkpoint_id) FROM checkpoints WHERE thread_id = c.thread_id) as last_checkpoint_id
        FROM checkpoints c
        ORDER BY last_checkpoint_id DESC
    ''')
    user_ids = [row[0] for row in cursor.fetchall()]
    
    sessions = []
    for user_id in user_ids:
        # 获取该会话的检查点数量（消息数量）
        cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (user_id,))
        message_count = cursor.fetchone()[0]
        
        # 获取创建时间和最后访问时间
        # 由于数据库中没有created列，我们从checkpoint字段中提取时间戳
        cursor.execute('''
            SELECT checkpoint, checkpoint_id
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY checkpoint_id ASC
            LIMIT 1
        ''', (user_id,))
        first_checkpoint = cursor.fetchone()
        created_at = None
        
        cursor.execute('''
            SELECT checkpoint, checkpoint_id
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY checkpoint_id DESC
            LIMIT 1
        ''', (user_id,))
        last_checkpoint = cursor.fetchone()
        last_accessed = None
        
        # 尝试从checkpoint数据中提取时间戳
        if first_checkpoint and first_checkpoint[0]:
            try:
                checkpoint_data = msgpack.unpackb(first_checkpoint[0])
                created_at = checkpoint_data.get('ts', None)
            except:
                created_at = None
        
        if last_checkpoint and last_checkpoint[0]:
            try:
                checkpoint_data = msgpack.unpackb(last_checkpoint[0])
                last_accessed = checkpoint_data.get('ts', None)
            except:
                last_accessed = None
        
        # 获取最后一条消息作为预览
        cursor.execute('''
            SELECT checkpoint
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY checkpoint_id DESC
            LIMIT 1
        ''', (user_id,))
        last_checkpoint = cursor.fetchone()
        preview = ""
        
        if last_checkpoint and last_checkpoint[0]:
            try:
                checkpoint_data = msgpack.unpackb(last_checkpoint[0])
                channel_values = checkpoint_data.get('channel_values', {})
                messages = channel_values.get('messages', [])
                
                if messages:
                    # 查找第一条人类消息（HumanMessage）作为标题
                    first_human_message = None
                    for msg in messages:
                        # 处理ExtType格式的消息
                        if hasattr(msg, 'code') and hasattr(msg, 'data'):
                            try:
                                msg_data = msgpack.unpackb(msg.data)
                                if len(msg_data) > 2 and isinstance(msg_data[2], dict):
                                    msg_content = msg_data[2]
                                    msg_type = msg_content.get('type', '')
                                    if msg_type == 'human':
                                        first_human_message = msg_content
                                        break
                            except Exception as e:
                                logger.warning(f"解析ExtType消息失败: {e}")
                                continue
                        elif isinstance(msg, dict):
                            msg_type = msg.get('type', '')
                            if msg_type == 'human':
                                first_human_message = msg
                                break
                    
                    if first_human_message:
                        content = first_human_message.get('content', '')
                        if content:
                            # 取前7个字符作为标题
                            preview = content[:7]
                            if len(content) > 7:
                                preview += "..."
                        else:
                            preview = "消息内容为空"
                    else:
                        # 如果没有找到人类消息，使用最后一条消息
                        last_message_data = messages[-1]
                        if hasattr(last_message_data, 'code') and hasattr(last_message_data, 'data'):
                            try:
                                msg_data = msgpack.unpackb(last_message_data.data)
                                if len(msg_data) > 2 and isinstance(msg_data[2], dict):
                                    msg_content = msg_data[2]
                                    content = msg_content.get('content', '')
                                    if content:
                                        preview = content[:7]
                                        if len(content) > 7:
                                            preview += "..."
                                    else:
                                        preview = "消息内容为空"
                                else:
                                    preview = "消息格式不正确"
                            except Exception as e:
                                logger.warning(f"解析ExtType消息失败: {e}")
                                preview = "无法解析消息预览"
                        elif isinstance(last_message_data, dict):
                            content = last_message_data.get('content', '')
                            if content:
                                preview = content[:7]
                                if len(content) > 7:
                                    preview += "..."
                            else:
                                preview = "消息内容为空"
                        else:
                            preview = "消息格式无法解析"
                else:
                    preview = "无消息内容"
            except Exception as e:
                logger.warning(f"解析消息预览失败: {e}")
                preview = "无法解析消息预览"
        
        session_info = {
            "session_id": user_id,
            "message_count": message_count,
            "created_at": created_at,
            "last_accessed": last_accessed,
            "preview": preview
        }
        sessions.append(session_info)
    
    return {"sessions": sessions}

@router.get("/sessions/{session_id}", summary="获取指定会话详情", response_model=Dict[str, Any])
async def get_session(session_id: str):
    """
    获取指定会话的详细信息

    - **session_id**: 会话ID
    """
    
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="数据库文件不存在")

    # 使用全局连接，避免锁定问题
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 检查会话是否存在
    cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (session_id,))
    session_count = cursor.fetchone()[0]
    
    if session_count == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="会话不存在")

    # 获取会话的基本信息
    cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (session_id,))
    message_count = cursor.fetchone()[0]
    
    # 获取创建时间和最后访问时间
    cursor.execute('''
        SELECT checkpoint, checkpoint_id
        FROM checkpoints
        WHERE thread_id = ?
        ORDER BY checkpoint_id ASC
        LIMIT 1
    ''', (session_id,))
    first_checkpoint = cursor.fetchone()
    created_at = None
    
    cursor.execute('''
        SELECT checkpoint, checkpoint_id
        FROM checkpoints
        WHERE thread_id = ?
        ORDER BY checkpoint_id DESC
        LIMIT 1
    ''', (session_id,))
    last_checkpoint = cursor.fetchone()
    last_accessed = None
    
    # 尝试从checkpoint数据中提取时间戳
    if first_checkpoint and first_checkpoint[0]:
        try:
            checkpoint_data = msgpack.unpackb(first_checkpoint[0])
            created_at = checkpoint_data.get('ts', None)
        except:
            created_at = None
    
    if last_checkpoint and last_checkpoint[0]:
        try:
            checkpoint_data = msgpack.unpackb(last_checkpoint[0])
            last_accessed = checkpoint_data.get('ts', None)
        except:
            last_accessed = None
    
    # 获取最后一条消息作为预览
    cursor.execute('''
        SELECT checkpoint
        FROM checkpoints
        WHERE thread_id = ?
        ORDER BY checkpoint_id DESC
        LIMIT 1
    ''', (session_id,))
    last_checkpoint = cursor.fetchone()
    preview = ""
    
    if last_checkpoint and last_checkpoint[0]:
        try:
            checkpoint_data = msgpack.unpackb(last_checkpoint[0])
            channel_values = checkpoint_data.get('channel_values', {})
            messages = channel_values.get('messages', [])
            
            if messages:
                # 查找第一条人类消息（HumanMessage）作为标题
                first_human_message = None
                for msg in messages:
                    # 处理ExtType格式的消息
                    if hasattr(msg, 'code') and hasattr(msg, 'data'):
                        try:
                            msg_data = msgpack.unpackb(msg.data)
                            if len(msg_data) > 2 and isinstance(msg_data[2], dict):
                                msg_content = msg_data[2]
                                msg_type = msg_content.get('type', '')
                                if msg_type == 'human':
                                    first_human_message = msg_content
                                    break
                        except Exception as e:
                            logger.warning(f"解析ExtType消息失败: {e}")
                            continue
                    elif isinstance(msg, dict):
                        msg_type = msg.get('type', '')
                        if msg_type == 'human':
                            first_human_message = msg
                            break
                
                if first_human_message:
                    content = first_human_message.get('content', '')
                    if content:
                        # 取前7个字符作为标题
                        preview = content[:7]
                        if len(content) > 7:
                            preview += "..."
                    else:
                        preview = "消息内容为空"
                else:
                    # 如果没有找到人类消息，使用最后一条消息
                    last_message_data = messages[-1]
                    if hasattr(last_message_data, 'code') and hasattr(last_message_data, 'data'):
                        try:
                            msg_data = msgpack.unpackb(last_message_data.data)
                            if len(msg_data) > 2 and isinstance(msg_data[2], dict):
                                msg_content = msg_data[2]
                                content = msg_content.get('content', '')
                                if content:
                                    preview = content[:7]
                                    if len(content) > 7:
                                        preview += "..."
                                else:
                                    preview = "消息内容为空"
                            else:
                                preview = "消息格式不正确"
                        except Exception as e:
                            logger.warning(f"解析ExtType消息失败: {e}")
                            preview = "无法解析消息预览"
                    elif isinstance(last_message_data, dict):
                        content = last_message_data.get('content', '')
                        if content:
                            preview = content[:7]
                            if len(content) > 7:
                                preview += "..."
                        else:
                            preview = "消息内容为空"
                    else:
                        preview = "消息格式无法解析"
            else:
                preview = "无消息内容"
        except Exception as e:
            logger.warning(f"解析消息预览失败: {e}")
            preview = "无法解析消息预览"
    
    # 不关闭全局连接，保持连接开放
    # conn.close()
    
    return {
        "session_id": session_id,
        "message_count": message_count,
        "created_at": created_at,
        "last_accessed": last_accessed,
        "preview": preview
    }

@router.delete("/sessions/{session_id}", summary="删除指定会话", response_model=Dict[str, Any])
async def delete_session(session_id: str):
    """
    删除指定会话的所有数据

    - **session_id**: 会话ID
    """
        
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="数据库文件不存在")

    # 使用全局连接，避免锁定问题
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 检查会话是否存在
    cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (session_id,))
    session_count = cursor.fetchone()[0]
    
    if session_count == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="会话不存在")

    # 删除会话数据，添加重试机制
    max_retries = 3
    retry_delay = 0.5  # 秒
    checkpoints_deleted = 0
    writes_deleted = 0
    
    for attempt in range(max_retries):
        try:
            cursor.execute('DELETE FROM checkpoints WHERE thread_id = ?', (session_id,))
            checkpoints_deleted = cursor.rowcount
            cursor.execute('DELETE FROM writes WHERE thread_id = ?', (session_id,))
            writes_deleted = cursor.rowcount
            
            conn.commit()
            break  # 成功则退出重试循环
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e).lower() and attempt < max_retries - 1:
                logger.warning(f"数据库锁定，第 {attempt + 1} 次重试...")
                time.sleep(retry_delay * (2 ** attempt))  # 指数退避
                continue
            else:
                raise  # 重试次数用完或不是锁定错误，重新抛出异常
    
    # 不关闭全局连接，保持连接开放
    # conn.close()
    
    return {
        "checkpoints_deleted": checkpoints_deleted,
        "writes_deleted": writes_deleted
    }
