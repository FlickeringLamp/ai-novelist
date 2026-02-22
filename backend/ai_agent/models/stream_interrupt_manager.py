"""
流式传输中断管理器
用于管理AI流式响应的中断状态
"""
import asyncio

class StreamInterruptManager:
    """流式传输中断管理器"""
    
    def __init__(self):
        # 存储活跃的流式任务: {thread_id: asyncio.Event}
        self._active_tasks: dict[str, asyncio.Event] = {}
    
    def create_task(self, thread_id: str) -> None:
        """
        为指定的thread_id创建一个新的流式任务
        
        Args:
            thread_id: 线程ID
        """
        self._active_tasks[thread_id] = asyncio.Event()
    
    def interrupt_task(self, thread_id: str) -> bool:
        """
        中断指定thread_id的流式任务
        
        Args:
            thread_id: 线程ID
            
        Returns:
            是否成功中断
        """
        if thread_id in self._active_tasks:
            self._active_tasks[thread_id].set()
            return True
        return False
    
    def is_interrupted(self, thread_id: str) -> bool:
        """
        检查指定thread_id的任务是否被中断
        
        Args:
            thread_id: 线程ID
            
        Returns:
            是否被中断
        """
        if thread_id not in self._active_tasks:
            return False
        return self._active_tasks[thread_id].is_set()
    
    def remove_task(self, thread_id: str) -> None:
        """
        移除指定thread_id的已完成任务
        
        Args:
            thread_id: 线程ID
        """
        if thread_id in self._active_tasks:
            del self._active_tasks[thread_id]


# 全局中断管理器实例
stream_interrupt_manager = StreamInterruptManager()
