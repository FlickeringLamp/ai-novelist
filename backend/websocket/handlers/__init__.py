"""
WebSocket 处理器模块

通过导入子模块自动注册处理器
"""

import logging

logger = logging.getLogger(__name__)


def init_handlers() -> None:
    """
    初始化所有 WebSocket 处理器
    
    通过导入子模块，触发处理器自动注册到 ws_manager
    """
    from . import file_handler
    from . import heartbeat_handler
    logger.debug("WebSocket 处理器已初始化")
