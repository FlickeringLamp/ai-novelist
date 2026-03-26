"""
文件 WebSocket 服务 - 整合文件监控和 WebSocket 推送
"""
import asyncio
import logging
from typing import Optional
from fastapi import WebSocket
from backend.websocket.connection_manager import connection_manager, MessageType
from backend.file.file_watcher import file_watcher_service
from backend.file.file_service import get_file_tree_for_user

logger = logging.getLogger(__name__)


class FileWebSocketService:
    """
    文件 WebSocket 服务
    
    职责：
    1. 管理文件监控相关的 WebSocket 连接
    2. 将文件变化事件推送给前端
    3. 提供文件树刷新功能
    """
    
    CONNECTION_TYPE = "file"
    
    def __init__(self):
        self._is_watcher_started = False
    
    async def handle_connection(self, websocket: WebSocket, client_id: str):
        """
        处理文件 WebSocket 连接
        
        Args:
            websocket: FastAPI WebSocket 对象
            client_id: 客户端唯一标识（如用户ID或会话ID）
        """
        await connection_manager.connect(websocket, self.CONNECTION_TYPE, client_id)
        
        # 启动文件监控（如果还没启动）
        self._ensure_watcher_started()
        
        try:
            while True:
                # 接收前端消息
                data = await websocket.receive_text()
                await connection_manager.handle_message(
                    self.CONNECTION_TYPE, client_id, data
                )
        except Exception as e:
            logger.info(f"文件 WebSocket 连接关闭: client_id={client_id}, error={e}")
        finally:
            connection_manager.disconnect(self.CONNECTION_TYPE, client_id)
    
    def _ensure_watcher_started(self):
        """确保文件监控已启动"""
        if not self._is_watcher_started:
            # 添加文件变化回调
            file_watcher_service.add_callback(self._on_file_change)
            file_watcher_service.start_watching()
            self._is_watcher_started = True
            logger.info("文件监控服务已自动启动")
    
    def _on_file_change(self, event_dict: dict):
        """文件变化回调 - 广播给所有文件监控连接"""
        # 使用 asyncio.create_task 在事件循环中执行异步广播
        asyncio.create_task(
            connection_manager.broadcast_to_type(self.CONNECTION_TYPE, event_dict)
        )
    
    async def broadcast_file_tree_update(self):
        """
        广播文件树更新通知
        
        当前端收到 file_change 事件后，可以主动拉取新文件树
        或者调用此方法让后端推送完整文件树
        """
        try:
            file_tree = await get_file_tree_for_user()
            await connection_manager.broadcast_to_type(
                self.CONNECTION_TYPE,
                {
                    "type": MessageType.FILE_TREE_UPDATE,
                    "payload": {
                        "tree": file_tree,
                        "timestamp": asyncio.get_event_loop().time()
                    }
                }
            )
            logger.info("文件树更新已广播")
        except Exception as e:
            logger.error(f"广播文件树更新失败: {e}")
    
    def stop(self):
        """停止服务"""
        if self._is_watcher_started:
            file_watcher_service.remove_callback(self._on_file_change)
            file_watcher_service.stop_watching()
            self._is_watcher_started = False
            logger.info("文件 WebSocket 服务已停止")


# 全局服务实例
file_websocket_service = FileWebSocketService()
