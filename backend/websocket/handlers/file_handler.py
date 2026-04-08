import asyncio
import logging
from pathlib import Path
from backend.websocket.manager import ws_manager
from backend.file.file_watcher import file_watcher_service
from backend.file.file_service import get_file_tree_for_user, read_file
from backend.settings.settings import settings

logger = logging.getLogger(__name__)

# 标记文件监控是否已启动
_is_watcher_started = False
# 存储主线程的事件循环，用于在 watchdog 线程中调度任务
_main_loop: asyncio.AbstractEventLoop | None = None


async def _push_file_tree() -> None:
    """推送完整文件树到客户端"""
    if not ws_manager.is_connected():
        return
    try:
        file_tree = await get_file_tree_for_user(settings.DATA_DIR, settings.DATA_DIR)
        await ws_manager.send({"type": "file_tree_update", "payload": {"tree": file_tree}})
        logger.debug("文件树已推送")
    except Exception as e:
        logger.error(f"推送文件树失败: {e}")


async def _push_file_content(file_path: str) -> None:
    """推送文件内容到客户端"""
    if not ws_manager.is_connected():
        return
    try:
        # watchdog 传来的路径如: backend/data/演示文件.md
        # 去掉 DATA_DIR 前缀得到相对于 DATA_DIR 的路径（也是前端的标签ID）
        # 使用 Path 处理跨平台路径分隔符（Windows 用 \, Linux/Mac 用 /）
        file_path_obj = Path(file_path)
        data_dir_obj = Path(settings.DATA_DIR)
        
        try:
            relative_path = str(file_path_obj.relative_to(data_dir_obj))
        except ValueError:
            # 如果不在 DATA_DIR 下，直接使用原路径
            relative_path = file_path
        
        # 用相对路径读取文件内容（read_file 会基于 DATA_DIR 解析）
        content = await read_file(relative_path)
        
        logger.info(f"[DEBUG] 推送文件内容: path={relative_path}, content长度={len(content)}")
        
        # 推送文件内容
        await ws_manager.send({
            "type": "file_content_sync",
            "payload": {"path": relative_path, "content": content}
        })
        logger.debug(f"文件内容已推送: {relative_path}")
    except Exception as e:
        logger.error(f"推送文件内容失败: {e}")
        logger.exception(e)


def _on_file_change(event_dict: dict) -> None:
    """
    文件变化回调 - 自动推送完整文件树和文件内容
    在 watchdog 线程中执行，需要使用主事件循环调度任务
    """
    if not ws_manager.is_connected():
        logger.debug("没有活跃连接，跳过文件变化通知")
        return
    
    event_type = event_dict.get("payload", {}).get("event")
    file_path = event_dict.get("payload", {}).get("path")
    
    logger.info(f"文件变化: {event_dict}")

    if _main_loop is None:
        logger.warning("主事件循环未设置，无法推送")
        return

    # 总是推送文件树（结构可能变化）
    asyncio.run_coroutine_threadsafe(_push_file_tree(), _main_loop)
    
    # 文件内容修改时，推送文件内容
    if event_type == "modified" and file_path:
        asyncio.run_coroutine_threadsafe(_push_file_content(file_path), _main_loop)


def _ensure_watcher_started() -> None:
    """确保文件监控服务已启动"""
    global _is_watcher_started, _main_loop
    if not _is_watcher_started:
        # 保存主线程的事件循环
        _main_loop = asyncio.get_running_loop()
        file_watcher_service.set_callback(_on_file_change)
        file_watcher_service.start()
        _is_watcher_started = True
        logger.info("文件监控服务已启动")


def stop_watcher() -> None:
    """停止文件监控服务"""
    global _is_watcher_started
    if _is_watcher_started:
        file_watcher_service.stop()
        _is_watcher_started = False
        logger.info("文件监控服务已停止")


@ws_manager.handler("subscribe_file_changes")
async def handle_subscribe_file_changes(payload: dict) -> None:
    """订阅文件变化请求"""
    _ensure_watcher_started()
    await _push_file_tree()
    logger.info("客户端订阅了文件变化")


logger.info("文件处理器已注册")
