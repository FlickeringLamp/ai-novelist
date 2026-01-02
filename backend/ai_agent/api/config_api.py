import json
import logging
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

from backend.ai_agent.prompts.sys_prompts import (
    OUTLINE_PROMPT,
    WRITING_PROMPT,
    ADJUSTMENT_PROMPT
)


logger = logging.getLogger(__name__)

# 请求模型
class SetSelectedModelRequest(BaseModel):
    """设置选中的模型请求"""
    selectedModel: str = Field(..., description="选中的模型ID")
    selectedProvider: str = Field(default="", description="选中的提供商ID")

class SaveProviderConfigRequest(BaseModel):
    """保存提供商配置请求"""
    config_data: Dict[str, Any] = Field(..., description="提供商配置数据")

# 创建API路由器
router = APIRouter(prefix="/api/ai-config", tags=["AI Config"])


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

# API密钥相关API
@router.get("/api-key", summary="获取API密钥", response_model=Dict[str, str])
async def get_api_key():
    """
    获取API密钥配置
    
    Returns:
        Dict[str, str]: API密钥配置字典
    """
    try:
        config = load_store_config()
        
        # 返回所有API密钥配置
        return {
            "deepseekApiKey": config.get("deepseekApiKey", ""),
            "openrouterApiKey": config.get("openrouterApiKey", ""),
            "siliconflowApiKey": config.get("siliconflowApiKey", ""),
            "aliyunApiKey": config.get("aliyunApiKey", ""),
            "zhipuaiApiKey": config.get("zhipuaiApiKey", ""),
            "kimiApiKey": config.get("kimiApiKey", ""),
            "geminiApiKey": config.get("geminiApiKey", "")
        }
        
    except Exception as e:
        logger.error(f"获取API密钥失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取API密钥失败: {str(e)}")

# 选中的模型相关API
@router.get("/selected-model", summary="获取选中的模型", response_model=Dict[str, str])
async def get_selected_model():
    """
    获取当前选中的模型和提供商
    
    Returns:
        Dict[str, str]: 包含 selectedModel 和 selectedProvider 的字典
    """
    try:
        config = load_store_config()
        
        return {
            "selectedModel": config.get("selectedModel", ""),
            "selectedProvider": config.get("selectedProvider", "")
        }
        
    except Exception as e:
        logger.error(f"获取选中模型失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取选中模型失败: {str(e)}")

@router.post("/selected-model", summary="设置选中的模型", response_model=Dict[str, str])
async def set_selected_model(request: SetSelectedModelRequest):
    """
    设置当前选中的模型和提供商
    
    - **selectedModel**: 选中的模型ID
    - **selectedProvider**: 选中的提供商ID
    
    Returns:
        Dict[str, str]: 包含 selectedModel 和 selectedProvider 的字典
    """
    try:
        config = load_store_config()
        config["selectedModel"] = request.selectedModel
        config["selectedProvider"] = request.selectedProvider
        save_store_config(config)
        
        return {
            "selectedModel": request.selectedModel,
            "selectedProvider": request.selectedProvider
        }
        
    except Exception as e:
        logger.error(f"设置选中模型失败: {e}")
        raise HTTPException(status_code=500, detail=f"设置选中模型失败: {str(e)}")

# 提供商配置相关API
@router.get("/provider-config", summary="获取提供商配置", response_model=Dict[str, Any])
async def get_provider_config():
    """
    获取所有提供商配置
    
    Returns:
        Dict[str, Any]: 提供商配置字典
    """
    try:
        return load_store_config()
        
    except Exception as e:
        logger.error(f"获取提供商配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取提供商配置失败: {str(e)}")

@router.post("/provider-config", summary="保存提供商配置", response_model=Dict[str, Any])
async def save_provider_config(request: SaveProviderConfigRequest):
    """
    保存提供商配置
    
    - **config_data**: 提供商配置数据
    
    Returns:
        Dict[str, Any]: 保存后的配置数据
    """
    try:
        save_store_config(request.config_data)
        return request.config_data
        
    except Exception as e:
        logger.error(f"保存提供商配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存提供商配置失败: {str(e)}")

# 默认提示词相关API
@router.get("/default-prompts", summary="获取默认提示词", response_model=Dict[str, str])
async def get_default_prompts():
    """
    获取所有默认提示词配置
    
    Returns:
        Dict[str, str]: 包含 outline、writing、adjustment 提示词的字典
    """
    try:
        return {
            "outline": OUTLINE_PROMPT,
            "writing": WRITING_PROMPT,
            "adjustment": ADJUSTMENT_PROMPT
        }
        
    except Exception as e:
        logger.error(f"获取默认提示词失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取默认提示词失败: {str(e)}")