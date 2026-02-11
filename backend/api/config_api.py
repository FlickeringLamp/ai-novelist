import logging
from datetime import datetime
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.config.config import settings

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/config", tags=["Config"])

# 请求模型
class SetStoreValueRequest(BaseModel):
    """设置存储值请求"""
    key: str = Field(..., description="存储键名")
    value: Any = Field(..., description="存储值")


@router.get("/store", summary="获取存储值", response_model=Any)
async def get_store_value(key: str):
    """
    根据键名获取存储值
    
    - **key**: 存储键名（支持点号分隔的嵌套路径，如"provider.deepseek.key"）
    """
    # 支持点号分隔的嵌套路径
    keys = key.split('.')
    return settings.get_config(*keys)

@router.post("/store", summary="设置存储值", response_model=Any)
async def set_store_value(request: SetStoreValueRequest):
    """
    设置存储值
    
    - **key**: （可以是简单键名如"username"，也支持点号分隔的嵌套路径如"provider.deepseek.key"）
    - **value**: 存储值
    """
    # 支持点号分隔的嵌套路径
    keys = request.key.split('.')
    settings.update_config(request.value, *keys)
    
    return request.value


@router.get("/health", summary="健康检查")
async def health_check():
    """
    检查后端服务是否正常运行
    
    Returns:
        Dict: 服务状态信息
    """
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "ai-novelist-backend"
    }

