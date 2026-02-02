from typing import Dict, List
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)


class WebSocketManager:
    """WebSocket连接管理器，用于实时推送嵌入进度"""
    
    def __init__(self):
        # 存储活跃的WebSocket连接 {kb_id: [WebSocket]}
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, kb_id: str, websocket: WebSocket):
        """建立WebSocket连接"""
        await websocket.accept()
        # 初次调用则初始化再添加到内部属性，否则直接添加
        if kb_id not in self.active_connections:
            self.active_connections[kb_id] = []
        self.active_connections[kb_id].append(websocket)
        logger.info(f"WebSocket连接建立: kb_id={kb_id}, 当前连接数={len(self.active_connections[kb_id])}")
    
    def disconnect(self, kb_id: str, websocket: WebSocket):
        """断开WebSocket连接"""
        if kb_id in self.active_connections:
            if websocket in self.active_connections[kb_id]:
                self.active_connections[kb_id].remove(websocket)
            # 如果该知识库经过上面的操作后没有连接了，删除它
            if not self.active_connections[kb_id]:
                del self.active_connections[kb_id]
            logger.info(f"WebSocket连接断开: kb_id={kb_id}, 剩余连接数={len(self.active_connections.get(kb_id, []))}")
    
    async def _send_progress(self, kb_id: str, message: dict):
        """向指定知识库的所有连接发送进度消息"""
        logger.info(f"尝试发送进度消息: kb_id={kb_id}, message={message}")
        if kb_id in self.active_connections:
            logger.info(f"找到 {len(self.active_connections[kb_id])} 个活跃连接")
            disconnected = []
            for connection in self.active_connections[kb_id]:
                try:
                    await connection.send_json(message)
                    logger.info(f"成功发送进度消息到连接")
                except Exception as e:
                    logger.error(f"发送进度消息失败: {e}")
                    disconnected.append(connection)
            
            # 移除断开的连接
            for connection in disconnected:
                self.disconnect(kb_id, connection)
        else:
            logger.warning(f"没有找到知识库 {kb_id} 的活跃连接")
    
    async def broadcast_progress(self, kb_id: str, current: int, total: int, message: str = ""):
        """广播进度消息"""
        progress_data = {
            "current": current,
            "total": total,
            "percentage": round((current / total * 100), 2) if total > 0 else 0,
            "message": message
        }
        logger.info(f"广播进度消息: kb_id={kb_id}, progress_data={progress_data}")
        await self._send_progress(kb_id, progress_data)


# 全局WebSocket管理器实例
websocket_manager = WebSocketManager()
