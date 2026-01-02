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
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/config", tags=["Config"])

# 请求模型
class SetStoreValueRequest(BaseModel):
    """设置存储值请求"""
    key: str = Field(..., description="存储键名", min_length=1)
    value: Any = Field(..., description="存储值")


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
@router.get("/store", summary="获取存储值", response_model=Any)
async def get_store_value(key: str):
    """
    根据键名获取存储值
    
    - **key**: 存储键名
    """
    try:
        config = load_store_config()
        value = config.get(key)
        
        return value
        
    except Exception as e:
        logger.error(f"获取存储值失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取存储值失败: {str(e)}")

@router.post("/store", summary="设置存储值", response_model=Any)
async def set_store_value(request: SetStoreValueRequest):
    """
    设置存储值
    
    - **key**: 存储键名
    - **value**: 存储值
    """
    try:
        config = load_store_config()
        config[request.key] = request.value
        save_store_config(config)
        
        return request.value
        
    except Exception as e:
        logger.error(f"设置存储值失败: {e}")
        raise HTTPException(status_code=500, detail=f"设置存储值失败: {str(e)}")

