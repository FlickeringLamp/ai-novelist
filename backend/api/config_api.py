import json
import logging
from typing import Any, Dict, List
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.core.ai_agent.prompts.sys_prompts import (
    OUTLINE_PROMPT,
    WRITING_PROMPT,
    ADJUSTMENT_PROMPT
)
from backend.core.ai_agent.core.tool_config_manager import tool_config_manager

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/config", tags=["Config"])

# 请求模型
class SetStoreValueRequest(BaseModel):
    """设置存储值请求"""
    key: str = Field(..., description="存储键名", min_length=1)
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


def load_store_config():
    """加载存储配置"""
    try:
        config_path = Path("backend/data/config/store.json")
        if not config_path.exists():
            logger.warning("配置文件不存在，创建默认配置")
            default_config = {}
            save_store_config(default_config)
            return default_config
        
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"加载配置文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"加载配置文件失败: {str(e)}")

def save_store_config(config: Dict[str, Any]):
    """保存存储配置"""
    try:
        config_path = Path("backend/data/config/store.json")
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"保存配置文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存配置文件失败: {str(e)}")


# ========== 通用配置API端点 ==========

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


# ========== AI配置API端点 ==========

# API密钥相关API
@router.get("/ai/api-key", summary="获取API密钥", response_model=Dict[str, str])
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
@router.get("/ai/selected-model", summary="获取选中的模型", response_model=Dict[str, str])
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

@router.post("/ai/selected-model", summary="设置选中的模型", response_model=Dict[str, str])
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
@router.get("/ai/provider-config", summary="获取提供商配置", response_model=Dict[str, Any])
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

@router.post("/ai/provider-config", summary="保存提供商配置", response_model=Dict[str, Any])
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
@router.get("/ai/default-prompts", summary="获取默认提示词", response_model=Dict[str, str])
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


# ========== 工具配置API端点 ==========

@router.get("/tool/modes", summary="获取所有模式的工具配置", response_model=Dict[str, Any])
async def get_all_modes_tool_config():
    """获取所有模式的工具配置"""
    try:
        # 获取所有内置模式
        builtin_modes = tool_config_manager.get_default_mode_tools()
        
        # 获取所有自定义模式（从配置中）
        config = tool_config_manager.load_config()
        custom_modes = config.get("customModes", [])
        
        # 构建响应数据
        response_data = {}
        
        # 添加内置模式
        for mode_id, config in builtin_modes.items():
            response_data[mode_id] = {
                "id": mode_id,
                "name": mode_id.capitalize(),
                "type": "builtin",
                "enabled_tools": tool_config_manager.get_tools_for_mode(mode_id),
                "description": config.get("description", ""),
                "tool_categories": tool_config_manager.get_tool_categories()
            }
        
        # 添加自定义模式
        for custom_mode in custom_modes:
            mode_id = custom_mode.get("id")
            if mode_id:
                response_data[mode_id] = {
                    "id": mode_id,
                    "name": custom_mode.get("name", mode_id),
                    "type": "custom",
                    "enabled_tools": tool_config_manager.get_tools_for_mode(mode_id),
                    "description": custom_mode.get("description", "自定义模式"),
                    "tool_categories": tool_config_manager.get_tool_categories()
                }
        
        return response_data
    
    except Exception as e:
        logger.error(f"获取模式工具配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取模式工具配置失败: {str(e)}")

@router.get("/tool/modes/{mode_id}", summary="获取指定模式的工具配置", response_model=Dict[str, Any])
async def get_mode_tool_config(mode_id: str):
    """获取指定模式的工具配置"""
    try:
        tool_info = tool_config_manager.get_mode_tool_info(mode_id)
        
        return {
            "mode_id": mode_id,
            "enabled_tools": tool_info.get("enabled_tools", []),
            "description": tool_info.get("description", ""),
            "tool_categories": tool_config_manager.get_tool_categories(),
            "all_available_tools": tool_config_manager.get_all_available_tools()
        }
    
    except Exception as e:
        logger.error(f"获取模式 '{mode_id}' 工具配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取模式 '{mode_id}' 工具配置失败: {str(e)}")

@router.put("/tool/modes/{mode_id}", summary="更新指定模式的工具配置", response_model=Dict[str, Any])
async def update_mode_tool_config(mode_id: str, request: UpdateModeToolConfigRequest):
    """
    更新指定模式的工具配置
    
    - **mode_id**: 模式ID
    - **enabled_tools**: 启用的工具列表
    
    Returns:
        Dict[str, Any]: 包含 mode_id 和 enabled_tools 的字典
    """
    try:
        # 更新工具配置
        tool_config_manager.set_tools_for_mode(mode_id, request.enabled_tools)
        
        return {
            "mode_id": mode_id,
            "enabled_tools": request.enabled_tools
        }
    
    except Exception as e:
        logger.error(f"更新模式 '{mode_id}' 工具配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新模式 '{mode_id}' 工具配置失败: {str(e)}")

@router.post("/tool/modes/{mode_id}/reset", summary="重置指定模式的工具配置", response_model=Dict[str, Any])
async def reset_mode_tool_config(mode_id: str):
    """重置指定模式的工具配置为默认值"""
    try:
        tool_config_manager.reset_mode_tools(mode_id)
        
        # 获取重置后的配置
        default_config = tool_config_manager.get_default_mode_tools().get(mode_id, {})
        
        return {
            "mode_id": mode_id,
            "enabled_tools": default_config.get("enabled_tools", [])
        }
    
    except Exception as e:
        logger.error(f"重置模式 '{mode_id}' 工具配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"重置模式 '{mode_id}' 工具配置失败: {str(e)}")

@router.get("/tool/available-tools", summary="获取所有可用的工具", response_model=Dict[str, Any])
async def get_available_tools():
    """获取所有可用的工具"""
    try:
        return {
            "all_tools": tool_config_manager.get_all_available_tools(),
            "tool_categories": tool_config_manager.get_tool_categories()
        }
    except Exception as e:
        logger.error(f"获取可用工具失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取可用工具失败: {str(e)}")

@router.get("/tool/default-config", summary="获取默认工具配置", response_model=Dict[str, Any])
async def get_default_tool_config():
    """获取默认工具配置"""
    try:
        return {
            "default_mode_tools": tool_config_manager.get_default_mode_tools()
        }
    
    except Exception as e:
        logger.error(f"获取默认工具配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取默认工具配置失败: {str(e)}")
