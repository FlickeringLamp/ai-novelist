"""基于Git的检查点API，用于管理文件归档。"""

import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

from backend.git.checkpoint_service import get_checkpoint_service

logger = logging.getLogger(__name__)

# 创建路由
checkpoint_router = APIRouter(prefix="/api/checkpoints", tags=["checkpoints"])

class SaveCheckpointRequest(BaseModel):
    """保存检查点请求。"""
    message: Optional[str] = Field(default=None,description="检查点消息。如果未提供，将使用自动生成的时间戳。")
class RestoreCheckpointRequest(BaseModel):
    """恢复检查点请求。"""
    commit_hash: str = Field(..., description="要恢复的提交哈希")

# API 端点
@checkpoint_router.get("/status")
async def get_status():
    """
    获取当前Git状态。
    """
    try:
        service = get_checkpoint_service()
        status = service.get_status()
        return status
    except Exception as e:
        logger.error(f"获取状态失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@checkpoint_router.get("/list")
async def list_checkpoints():
    """
    列出所有检查点。
    """
    try:
        service = get_checkpoint_service()
        checkpoints = service.list_checkpoints()
        return {
            "success": True,
            "checkpoints": checkpoints,
            "count": len(checkpoints),
        }
    except Exception as e:
        logger.error(f"列出检查点失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@checkpoint_router.post("/save")
async def save_checkpoint(request: SaveCheckpointRequest):
    """
    将当前状态保存为检查点。
    """
    try:
        service = get_checkpoint_service()
        result = service.save_checkpoint(message=request.message)
        return result
    except Exception as e:
        logger.error(f"保存检查点失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@checkpoint_router.post("/restore")
async def restore_checkpoint(request: RestoreCheckpointRequest):
    """
    将工作区恢复到指定检查点。
    """
    try:
        service = get_checkpoint_service()
        result = service.restore_checkpoint(commit_hash=request.commit_hash)
        return result
    except Exception as e:
        logger.error(f"恢复检查点失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@checkpoint_router.get("/diff/{commit_hash}")
async def get_checkpoint_diff(commit_hash: str):
    """
    获取检查点与上一个检查点之间的差异。
    """
    try:
        service = get_checkpoint_service()
        result = service.get_checkpoint_diff(commit_hash=commit_hash)
        return result
    except Exception as e:
        logger.error(f"获取差异失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@checkpoint_router.get("/working-diff/{file_path:path}")
async def get_working_diff(file_path: str):
    """
    获取当前工作区中指定文件与最新提交之间的差异。
    """
    try:
        service = get_checkpoint_service()
        result = service.get_working_diff(file_path=file_path)
        return result
    except Exception as e:
        logger.error(f"获取工作区差异失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


