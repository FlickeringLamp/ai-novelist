"""
WebSocket API 路由

统一 WebSocket 端点：/ws
"""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.websocket import ws_manager
from backend.websocket.handlers import init_handlers
from backend.websocket.handlers.file_handler import stop_watcher

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])

# 初始化所有处理器
init_handlers()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket 统一端点
    连接示例：
        ws://localhost:8000/ws
    
    消息格式：
        {"type": "message_type", "payload": {...}}
    
    支持的类型：
        - ping: 心跳
        - subscribe_file_changes: 订阅文件变化（自动返回初始文件树）
        - ... 更多类型通过 register_handler 注册
    """
    await ws_manager.connect(websocket)
    
    try:
        while True:
            # 接收前端消息
            data = await websocket.receive_text()
            await ws_manager.handle_message(data)
    except WebSocketDisconnect:
        logger.info("WebSocket 断开")
    except Exception as e:
        logger.error(f"WebSocket 错误: error={e}")
    finally:
        ws_manager.disconnect()
        stop_watcher()
