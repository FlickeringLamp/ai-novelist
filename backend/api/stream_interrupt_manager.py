"""
流式传输中断管理器
用于管理AI流式响应的中断状态
"""
import asyncio
from typing import Optional
import uuid

class StreamInterruptManager:
    """流式传输中断管理器"""
    
    def __init__(self):
        # 存储活跃的流式任务: {task_id: asyncio.Event}
        self._active_tasks: dict[str, asyncio.Event] = {}
        # 存储任务对应的线程ID，用于跨线程访问
        self._task_threads: dict[str, int] = {}
    
    def create_task(self) -> str:
        """
        创建一个新的流式任务
        
        Returns:
            任务ID
        """
        task_id = str(uuid.uuid4())
        self._active_tasks[task_id] = asyncio.Event()
        return task_id
    
    def interrupt_task(self, task_id: str) -> bool:
        """
        中断指定的流式任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            是否成功中断
        """
        if task_id in self._active_tasks:
            self._active_tasks[task_id].set()
            return True
        return False
    
    def is_interrupted(self, task_id: str) -> bool:
        """
        检查任务是否被中断
        
        Args:
            task_id: 任务ID
            
        Returns:
            是否被中断
        """
        if task_id not in self._active_tasks:
            return False
        return self._active_tasks[task_id].is_set()
    
    def remove_task(self, task_id: str):
        """
        移除已完成的任务
        
        Args:
            task_id: 任务ID
        """
        if task_id in self._active_tasks:
            del self._active_tasks[task_id]
        if task_id in self._task_threads:
            del self._task_threads[task_id]
    
    def get_event(self, task_id: str) -> Optional[asyncio.Event]:
        """
        获取任务的中断事件
        
        Args:
            task_id: 任务ID
            
        Returns:
            中断事件对象
        """
        return self._active_tasks.get(task_id)


# 全局中断管理器实例
stream_interrupt_manager = StreamInterruptManager()
