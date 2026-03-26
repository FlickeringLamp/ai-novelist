"""
文件监控服务 - 使用 watchdog 监控文件变化并通过 WebSocket 推送
"""
import os
import logging
import asyncio
from typing import Callable, Set, Optional
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from backend.settings.settings import settings

logger = logging.getLogger(__name__)


class FileChangeHandler(FileSystemEventHandler):
    """文件事件处理器"""
    
    def __init__(self, callback: Callable[[dict], None], ignore_patterns: Optional[Set[str]] = None):
        """
        Args:
            callback: 文件变化回调函数，接收事件字典
            ignore_patterns: 忽略的文件模式集合
        """
        self.callback = callback
        self.ignore_patterns = ignore_patterns or {'.git', '__pycache__', '.idea', '.vscode', 'node_modules'}
        self._loop = asyncio.get_event_loop()
    
    def _should_ignore(self, path: str) -> bool:
        """检查路径是否应该被忽略"""
        path_parts = Path(path).parts
        return any(pattern in path_parts for pattern in self.ignore_patterns)
    
    def _make_event_dict(self, event: FileSystemEvent, event_type: str) -> dict:
        """将 watchdog 事件转换为统一格式的字典"""
        return {
            "type": "file_change",
            "payload": {
                "event": event_type,
                "path": event.src_path,
                "isFolder": event.is_directory,
                "oldPath": event.dest_path if hasattr(event, 'dest_path') else None,
                "timestamp": asyncio.get_event_loop().time()
            }
        }
    
    def on_created(self, event: FileSystemEvent):
        if not self._should_ignore(event.src_path):
            logger.info(f"文件创建: {event.src_path}")
            self.callback(self._make_event_dict(event, "created"))
    
    def on_modified(self, event: FileSystemEvent):
        if not self._should_ignore(event.src_path) and not event.is_directory:
            logger.info(f"文件修改: {event.src_path}")
            self.callback(self._make_event_dict(event, "modified"))
    
    def on_deleted(self, event: FileSystemEvent):
        if not self._should_ignore(event.src_path):
            logger.info(f"文件删除: {event.src_path}")
            self.callback(self._make_event_dict(event, "deleted"))
    
    def on_moved(self, event: FileSystemEvent):
        if not self._should_ignore(event.src_path):
            logger.info(f"文件移动: {event.src_path} -> {event.dest_path}")
            self.callback(self._make_event_dict(event, "moved"))


class FileWatcherService:
    """文件监控服务"""
    
    def __init__(self):
        self.observer: Optional[Observer] = None
        self._handlers: list = []
        self._watch_paths: Set[str] = set()
        self._callbacks: list[Callable[[dict], None]] = []
    
    def add_callback(self, callback: Callable[[dict], None]):
        """添加文件变化回调"""
        self._callbacks.append(callback)
    
    def remove_callback(self, callback: Callable[[dict], None]):
        """移除文件变化回调"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    def _on_file_change(self, event_dict: dict):
        """内部文件变化处理器 - 分发给所有回调"""
        for callback in self._callbacks:
            try:
                callback(event_dict)
            except Exception as e:
                logger.error(f"文件变化回调执行失败: {e}")
    
    def start_watching(self, paths: Optional[list[str]] = None):
        """
        开始监控指定路径
        
        Args:
            paths: 要监控的路径列表，默认为 DATA_DIR
        """
        if self.observer:
            logger.warning("文件监控已在运行")
            return
        
        watch_paths = paths or [settings.DATA_DIR]
        
        self.observer = Observer()
        handler = FileChangeHandler(self._on_file_change)
        self._handlers.append(handler)
        
        for path in watch_paths:
            if os.path.exists(path):
                self.observer.schedule(handler, path, recursive=True)
                self._watch_paths.add(path)
                logger.info(f"开始监控路径: {path}")
            else:
                logger.warning(f"监控路径不存在: {path}")
        
        self.observer.start()
        logger.info("文件监控服务已启动")
    
    def stop_watching(self):
        """停止文件监控"""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            self.observer = None
            self._handlers.clear()
            self._watch_paths.clear()
            logger.info("文件监控服务已停止")
    
    def is_running(self) -> bool:
        """检查监控是否正在运行"""
        return self.observer is not None and self.observer.is_alive()


# 全局文件监控服务实例
file_watcher_service = FileWatcherService()
