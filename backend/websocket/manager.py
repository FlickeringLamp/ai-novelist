import json
import logging
from typing import Dict, Callable
from fastapi import WebSocket

logger = logging.getLogger(__name__)

# 消息处理器类型
MessageHandler = Callable[[dict], None]  # (payload) -> None


class WebSocketManager:
    """
    WebSocket 连接管理器
    """
    
    def __init__(self):
        # 单一连接
        self._websocket: WebSocket | None = None
        # 消息处理器: {message_type: handler}
        self._handlers: Dict[str, MessageHandler] = {}
        
    async def connect(self, websocket: WebSocket) -> None:
        """
        接受 WebSocket 连接
        
        Args:
            websocket: FastAPI WebSocket 对象
        """
        # 如果已有连接，先断开旧的
        if self._websocket is not None:
            logger.warning("检测到已有连接，断开旧连接")
            try:
                await self._websocket.close()
            except Exception:
                pass
        
        await websocket.accept()
        self._websocket = websocket
        logger.info("WebSocket 连接建立")
    
    def disconnect(self) -> None:
        """断开当前 WebSocket 连接"""
        self._websocket = None
        logger.info("WebSocket 连接断开")
    
    def register_handler(self, msg_type: str, handler: MessageHandler) -> None:
        """
        注册消息处理器
        
        Args:
            msg_type: 消息类型
            handler: 处理函数，接收 (payload) 参数
        """
        self._handlers[msg_type] = handler
        logger.debug(f"注册消息处理器: type={msg_type}")

    def handler(self, msg_type: str):
        """装饰器注册处理器: @ws_manager.handler('ping')"""
        def decorator(func: MessageHandler) -> MessageHandler:
            self.register_handler(msg_type, func)
            return func
        return decorator
    
    async def handle_message(self, raw_message: str) -> None:
        """
        处理收到的消息
        
        Args:
            raw_message: 原始消息字符串
        """
        try:
            message = json.loads(raw_message)
            msg_type = message.get("type")
            payload = message.get("payload", {})
            
            # 查找并执行处理器
            handler = self._handlers.get(msg_type)
            if handler:
                try:
                    await handler(payload)
                except Exception as e:
                    logger.error(f"消息处理器执行失败: type={msg_type}, error={e}")
                    await self.send({
                        "type": "error", 
                        "payload": {"message": f"Handler error: {str(e)}"}
                    })
            else:
                logger.warning(f"未找到消息处理器: type={msg_type}")
                await self.send({
                    "type": "error", 
                    "payload": {"message": f"Unknown message type: {msg_type}"}
                })
                
        except json.JSONDecodeError:
            logger.error(f"无效的 JSON 消息: {raw_message}")
            await self.send({
                "type": "error",
                "payload": {"message": "Invalid JSON format"}
            })
        except Exception as e:
            logger.error(f"处理消息失败: {e}")
    
    async def send(self, message: dict) -> bool:
        """
        发送消息到客户端
        
        Args:
            message: 消息字典
            
        Returns:
            是否发送成功
        """
        if self._websocket is None:
            return False
            
        try:
            await self._websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"发送消息失败: error={e}")
            self.disconnect()
            return False
    
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._websocket is not None


# 全局管理器实例
ws_manager = WebSocketManager()


def _init_handlers() -> None:
    """初始化所有消息处理器 - 在模块加载时自动调用"""
    # 延迟导入避免循环依赖
    from backend.websocket.handlers import heartbeat_handler
    from backend.websocket.handlers import file_handler
    # 后续添加其他处理器...
    # from backend.websocket.handlers import chat_handler
    # from backend.websocket.handlers import notification_handler


# 自动初始化处理器
_init_handlers()
