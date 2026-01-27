import json
import logging
from typing import Any, Dict, List
from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.config import settings, ALL_AVAILABLE_TOOLS

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/config", tags=["Config"])

# 请求模型
class SetStoreValueRequest(BaseModel):
    """设置存储值请求"""
    key: str = Field(..., description="存储键名")
    value: Any = Field(..., description="存储值")

class SetSelectedModelRequest(BaseModel):
    """设置选中的模型请求"""
    selectedModel: str = Field(..., description="选中的模型ID")
    selectedProvider: str = Field(default="", description="选中的提供商ID")

class SaveProviderConfigRequest(BaseModel):
    """保存提供商配置请求"""
    config_data: Dict[str, Any] = Field(..., description="提供商配置数据")

class UpdateModeToolConfigRequest(BaseModel):
    """更新模式工具配置请求"""
    enabled_tools: List[str] = Field(..., description="启用的工具列表")


# ========== 通用配置API端点 ==========

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


# ========== AI配置API端点 ==========

# API密钥相关API
@router.get("/ai/api-key", summary="获取API密钥", response_model=Dict[str, str])
async def get_api_key():
    """
    获取API密钥配置
    
    Returns:
        Dict[str, str]: API密钥配置字典
    """
    provider_config = settings.get_config("provider", default={})
    
    # 返回所有提供商的API密钥
    return {
        "deepseekApiKey": provider_config.get("deepseek", {}).get("key", ""),
        "openrouterApiKey": provider_config.get("openrouter", {}).get("key", ""),
        "siliconflowApiKey": provider_config.get("siliconflow", {}).get("key", ""),
        "aliyunApiKey": provider_config.get("aliyun", {}).get("key", ""),
        "zhipuaiApiKey": provider_config.get("zhipuai", {}).get("key", ""),
        "kimiApiKey": provider_config.get("kimi", {}).get("key", ""),
        "ollamaApiKey": provider_config.get("ollama", {}).get("key", "")
    }

# 选中的模型相关API
@router.get("/ai/selected-model", summary="获取选中的模型", response_model=Dict[str, str])
async def get_selected_model():
    """
    获取当前选中的模型和提供商
    
    Returns:
        Dict[str, str]: 包含 selectedModel 和 selectedProvider 的字典
    """
    return {
        "selectedModel": settings.get_config("selectedModel", default=""),
        "selectedProvider": settings.get_config("selectedProvider", default="")
    }

@router.post("/ai/selected-model", summary="设置选中的模型", response_model=Dict[str, str])
async def set_selected_model(request: SetSelectedModelRequest):
    """
    设置当前选中的模型和提供商
    
    - **selectedModel**: 选中的模型ID
    - **selectedProvider**: 选中的提供商ID
    
    Returns:
        Dict[str, str]: 包含 selectedModel 和 selectedProvider 的字典
    """
    settings.update_config(request.selectedModel, "selectedModel")
    settings.update_config(request.selectedProvider, "selectedProvider")
    
    return {
        "selectedModel": request.selectedModel,
        "selectedProvider": request.selectedProvider
    }

@router.get("/tool/modes", summary="获取所有模式的工具配置", response_model=Dict[str, Any])
async def get_all_modes_tool_config():
    """获取所有模式的工具配置"""
    # 获取所有内置模式
    all_mode_config = settings.get_config("mode", default={})
    
    # 构建响应数据
    response_data = {}
    
    for mode_id, config in all_mode_config.items():
        response_data[mode_id] = {
            "id": mode_id,
            "name": mode_id.capitalize(),
            "type": "builtin",
            "enabled_tools": config.get("tools", [])
        }
    
    return response_data

@router.get("/tool/modes/{mode_id}", summary="获取指定模式的工具配置", response_model=Dict[str, Any])
async def get_mode_tool_config(mode_id: str):
    """获取指定模式的工具配置"""
    tool_config = settings.get_config("mode", mode_id, "tools", default=[])
    return {
        "mode_id": mode_id,
        "enabled_tools": tool_config
    }

@router.put("/tool/modes/{mode_id}", summary="更新指定模式的工具配置", response_model=Dict[str, Any])
async def update_mode_tool_config(mode_id: str, request: UpdateModeToolConfigRequest):
    """
    更新指定模式的工具配置
    
    - **mode_id**: 模式ID
    - **enabled_tools**: 启用的工具列表
    
    Returns:
        Dict[str, Any]: 包含 mode_id 和 enabled_tools 的字典
    """
    # 更新工具配置
    settings.update_config(request.enabled_tools, "mode", mode_id, "tools")
    
    return {
        "mode_id": mode_id,
        "enabled_tools": request.enabled_tools
    }

@router.get("/tool/available-tools", summary="获取所有可用的工具", response_model=Dict[str, Any])
async def get_available_tools():
    """获取所有可用的工具"""
    return {
        "all_tools": ALL_AVAILABLE_TOOLS
    }

