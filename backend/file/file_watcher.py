"""
文件监控服务 - 使用 watchdog 监控文件变化并通过 WebSocket 推送
"""
import os
import logging
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from backend.settings.settings import settings

logger = logging.getLogger(__name__)


class FileWatcherService(FileSystemEventHandler):
    """文件监控服务 - 直接继承 FileSystemEventHandler"""

    def __init__(self):
        super().__init__()
        self._observer: Observer | None = None
        self._callback: callable = None
        self._ignore_patterns = {'.git', 'db', 'chromadb'}

    def set_callback(self, callback: callable):
        """设置文件变化回调函数"""
        self._callback = callback

    def _should_ignore(self, path: str) -> bool:
        """检查路径是否应该被忽略"""
        return any(p in Path(path).parts for p in self._ignore_patterns)

    def _notify(self, event: FileSystemEvent, event_type: str):
        """通知回调"""
        if self._callback is None:
            return

        event_dict = {
            "type": "file_change",
            "payload": {
                "event": event_type,
                "path": event.src_path,
                "isFolder": event.is_directory,
                "oldPath": event.dest_path if hasattr(event, 'dest_path') else None,
                "timestamp": time.time()
            }
        }
        try:
            self._callback(event_dict)
        except Exception as e:
            logger.error(f"文件变化回调执行失败: {e}")

    # watchdog 事件处理器,虽然不被其他代码使用，但是是库会在对应的事件时自动调用

    def on_created(self, event: FileSystemEvent):
        if not self._should_ignore(event.src_path):
            logger.info(f"文件创建: {event.src_path}")
            self._notify(event, "created")

    def on_modified(self, event: FileSystemEvent):
        if not self._should_ignore(event.src_path) and not event.is_directory:
            logger.info(f"文件修改: {event.src_path}")
            self._notify(event, "modified")

    def on_deleted(self, event: FileSystemEvent):
        if not self._should_ignore(event.src_path):
            logger.info(f"文件删除: {event.src_path}")
            self._notify(event, "deleted")

    def on_moved(self, event: FileSystemEvent):
        if not self._should_ignore(event.src_path):
            logger.info(f"文件移动: {event.src_path} -> {event.dest_path}")
            self._notify(event, "moved")

    # === 服务控制 ===

    def start(self):
        """开始监控"""
        if self._observer:
            logger.warning("文件监控已在运行")
            return

        self._observer = Observer()

        if os.path.exists(settings.DATA_DIR):
            self._observer.schedule(self, settings.DATA_DIR, recursive=True)
            logger.info(f"开始监控路径: {settings.DATA_DIR}")
        else:
            logger.warning(f"监控路径不存在: {settings.DATA_DIR}")

        self._observer.start()
        logger.info("文件监控服务已启动")

    def stop(self):
        """停止监控"""
        if self._observer:
            self._observer.stop()
            self._observer.join()
            self._observer = None
            logger.info("文件监控服务已停止")


# 全局实例
file_watcher_service = FileWatcherService()
