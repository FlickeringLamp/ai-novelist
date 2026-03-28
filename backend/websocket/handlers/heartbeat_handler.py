import logging
from backend.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


@ws_manager.handler("ping")
async def handle_ping(payload: dict) -> None:
    """心跳响应"""
    await ws_manager.send({
        "type": "pong",
        "payload": {"timestamp": payload.get("timestamp"), "status": "ok"}
    })


logger.info("心跳处理器已注册")
