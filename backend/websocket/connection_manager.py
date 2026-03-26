"""
通用 WebSocket 连接管理器 - 支持多种消息类型
"""
import json
import logging
from typing import Dict, List, Callable, Any, Optional
from enum import Enum
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """WebSocket 消息类型"""
    # 文件相关
    FILE_CHANGE = "file_change"           # 文件变化通知
    FILE_TREE_UPDATE = "file_tree_update" # 文件树更新
    
    # 聊天相关
    CHAT_STREAM = "chat_stream"           # 聊天流式消息
    CHAT_INTERRUPT = "chat_interrupt"     # 聊天中断请求
    
    # 知识库相关
    EMBEDDING_PROGRESS = "embedding_progress"  # 嵌入进度
    KNOWLEDGE_UPDATE = "knowledge_update"      # 知识库更新
    
    # 系统通知
    SYSTEM_NOTIFY = "system_notify"       # 系统通知
    ERROR = "error"                       # 错误消息
    PING = "ping"                         # 心跳检测
    PONG = "pong"                         # 心跳响应


class ConnectionManager:
    """
    通用 WebSocket 连接管理器
    
    支持按类型分组管理连接，处理消息路由和广播
    """
    
    def __init__(self):
        # {connection_type: {client_id: WebSocket_object}}
        self._connections: Dict[str, Dict[str, WebSocket]] = {}
        # 消息处理器注册表 {message_type: [handler]}
        self._handlers: Dict[MessageType, List[Callable]] = {}
    
    async def connect(self, websocket: WebSocket, connection_type: str, client_id: str):
        """
        建立 WebSocket 连接
        
        Args:
            websocket: FastAPI WebSocket 对象
            connection_type: 连接类型（如 'file', 'chat', 'embedding'）
            client_id: 客户端唯一标识
        """
        await websocket.accept()
        
        if connection_type not in self._connections:
            self._connections[connection_type] = {}
        
        self._connections[connection_type][client_id] = websocket
        logger.info(f"WebSocket 连接建立: type={connection_type}, client_id={client_id}, "
                   f"当前连接数={len(self._connections[connection_type])}")
    
    def disconnect(self, connection_type: str, client_id: str):
        """断开 WebSocket 连接"""
        if connection_type in self._connections:
            if client_id in self._connections[connection_type]:
                del self._connections[connection_type][client_id]
                logger.info(f"WebSocket 连接断开: type={connection_type}, client_id={client_id}")
            
            # 清理空连接组
            if not self._connections[connection_type]:
                del self._connections[connection_type]
    
    def register_handler(self, message_type: MessageType, handler: Callable):
        """
        注册消息处理器
        
        Args:
            message_type: 消息类型
            handler: 处理函数，接收 (client_id: str, payload: dict) 参数
        """
        if message_type not in self._handlers:
            self._handlers[message_type] = []
        self._handlers[message_type].append(handler)
        logger.info(f"注册消息处理器: type={message_type.value}")
    
    async def send_to_client(self, connection_type: str, client_id: str, message: dict) -> bool:
        """
        向指定客户端发送消息
        
        Returns:
            发送是否成功
        """
        try:
            websocket = self._connections.get(connection_type, {}).get(client_id)
            if websocket:
                await websocket.send_json(message)
                return True
            return False
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            self.disconnect(connection_type, client_id)
            return False
    
    async def broadcast_to_type(self, connection_type: str, message: dict):
        """向指定类型的所有连接广播消息"""
        if connection_type not in self._connections:
            return
        
        disconnected = []
        for client_id, websocket in self._connections[connection_type].items():
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"广播消息失败 (client_id={client_id}): {e}")
                disconnected.append(client_id)
        
        # 清理断开的连接
        for client_id in disconnected:
            self.disconnect(connection_type, client_id)
    
    async def broadcast_all(self, message: dict):
        """向所有连接广播消息"""
        for connection_type in list(self._connections.keys()):
            await self.broadcast_to_type(connection_type, message)
    
    async def handle_message(self, connection_type: str, client_id: str, raw_message: str):
        """
        处理收到的消息
        
        Args:
            connection_type: 连接类型
            client_id: 客户端ID
            raw_message: 原始消息字符串
        """
        try:
            message = json.loads(raw_message)
            msg_type = message.get("type")
            payload = message.get("payload", {})
            
            # 处理心跳
            if msg_type == MessageType.PING:
                await self.send_to_client(connection_type, client_id, {
                    "type": MessageType.PONG,
                    "payload": {"timestamp": payload.get("timestamp")}
                })
                return
            
            # 查找并执行处理器
            handlers = self._handlers.get(msg_type, [])
            for handler in handlers:
                try:
                    await handler(client_id, payload)
                except Exception as e:
                    logger.error(f"消息处理器执行失败: {e}")
        
        except json.JSONDecodeError:
            logger.error(f"无效的 JSON 消息: {raw_message}")
            await self.send_to_client(connection_type, client_id, {
                "type": MessageType.ERROR,
                "payload": {"message": "Invalid JSON format"}
            })
        except Exception as e:
            logger.error(f"处理消息失败: {e}")
    
    def get_connection_info(self) -> dict:
        """获取当前连接信息"""
        return {
            connection_type: len(clients)
            for connection_type, clients in self._connections.items()
        }


# 全局连接管理器实例
connection_manager = ConnectionManager()
