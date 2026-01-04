import logging
from functools import wraps
from typing import Callable, Any
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def handle_api_errors(operation_name: str):
    """
    API端点异常处理装饰器
    
    Args:
        operation_name: 操作名称，用于日志和错误消息
    
    使用示例:
        @handle_api_errors("创建文件")
        async def create_file(request: CreateFileRequest):
            return await file_service.create_chapter(...)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"{operation_name}失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"{operation_name}失败: {str(e)}")
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"{operation_name}失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"{operation_name}失败: {str(e)}")
        
        # 根据函数是否为协程选择合适的包装器
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator
