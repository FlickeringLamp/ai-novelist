"""
WebSocket API 端点

提供统一的 WebSocket 入口，根据连接类型路由到不同服务
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from backend.websocket.connection_manager import connection_manager
from backend.websocket.file_websocket_service import file_websocket_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    type: str = Query(..., description="连接类型: file, chat, embedding"),
    client_id: str = Query(..., description="客户端唯一标识")
):
    """
    统一 WebSocket 端点
    
    根据 type 参数路由到不同服务：
    - file: 文件监控服务
    - chat: 聊天流式服务
    - embedding: 嵌入进度服务
    
    连接示例：
    ws://localhost:8000/ws?type=file&client_id=xxx
    """
    logger.info(f"新的 WebSocket 连接请求: type={type}, client_id={client_id}")
    
    try:
        if type == "file":
            await file_websocket_service.handle_connection(websocket, client_id)
        
        elif type == "chat":
            # TODO: 实现聊天 WebSocket 服务
            await websocket.accept()
            await connection_manager.connect(websocket, type, client_id)
            try:
                while True:
                    data = await websocket.receive_text()
                    await connection_manager.handle_message(type, client_id, data)
            except WebSocketDisconnect:
                logger.info(f"聊天 WebSocket 断开: client_id={client_id}")
            finally:
                connection_manager.disconnect(type, client_id)
        
        elif type == "embedding":
            # TODO: 迁移现有的嵌入进度 WebSocket
            await websocket.accept()
            await connection_manager.connect(websocket, type, client_id)
            try:
                while True:
                    data = await websocket.receive_text()
                    await connection_manager.handle_message(type, client_id, data)
            except WebSocketDisconnect:
                logger.info(f"嵌入 WebSocket 断开: client_id={client_id}")
            finally:
                connection_manager.disconnect(type, client_id)
        
        else:
            await websocket.accept()
            await websocket.send_json({
                "type": "error",
                "payload": {"message": f"未知的连接类型: {type}"}
            })
            await websocket.close()
    
    except Exception as e:
        logger.error(f"WebSocket 处理异常: {e}")
        try:
            await websocket.close()
        except:
            pass
