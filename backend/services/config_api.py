"""
配置存储API模块
为前端提供配置存储的RESTful API
"""

import json
import logging
import yaml
from typing import Any, Dict, Optional
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/config", tags=["Config"])

# 数据模型
class StoreValueRequest(BaseModel):
    """存储值请求模型"""
    key: str
    value: Any

class StoreValueResponse(BaseModel):
    """存储值响应模型"""
    success: bool
    message: str
    data: Optional[Any] = None

def load_store_config():
    """加载存储配置"""
    try:
        with open("backend/data/config/store.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning("配置文件不存在，创建默认配置")
        default_config = {}
        save_store_config(default_config)
        return default_config
    except Exception as e:
        logger.error(f"加载配置文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"加载配置文件失败: {str(e)}")

def save_store_config(config: Dict[str, Any]):
    """保存存储配置"""
    try:
        with open("backend/data/config/store.json", "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"保存配置文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存配置文件失败: {str(e)}")

# API端点
@router.get("/store", response_model=StoreValueResponse, summary="获取存储值")
async def get_store_value(key: str):
    """
    根据键名获取存储值
    
    - **key**: 存储键名
    """
    try:
        config = load_store_config()
        value = config.get(key)
        
        return StoreValueResponse(
            success=True,
            message="获取存储值成功",
            data=value
        )
        
    except Exception as e:
        logger.error(f"获取存储值失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取存储值失败: {str(e)}")

@router.post("/store", response_model=StoreValueResponse, summary="设置存储值")
async def set_store_value(request: StoreValueRequest):
    """
    设置存储值
    
    - **key**: 存储键名
    - **value**: 存储值
    """
    try:
        config = load_store_config()
        config[request.key] = request.value
        save_store_config(config)
        
        return StoreValueResponse(
            success=True,
            message="设置存储值成功",
            data=request.value
        )
        
    except Exception as e:
        logger.error(f"设置存储值失败: {e}")
        raise HTTPException(status_code=500, detail=f"设置存储值失败: {str(e)}")

