import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from backend.ai_agent.core.tool_config_manager import tool_config_manager

logger = logging.getLogger(__name__)

# 请求模型
class UpdateModeToolConfigRequest(BaseModel):
    """更新模式工具配置请求"""
    enabled_tools: List[str] = Field(..., description="启用的工具列表")

# 创建API路由器
router = APIRouter(prefix="/api/tool-config", tags=["Tool Config"])

@router.get("/modes", summary="获取所有模式的工具配置", response_model=Dict[str, Any])
async def get_all_modes_tool_config():
    """获取所有模式的工具配置"""
    try:
        # 获取所有内置模式
        builtin_modes = tool_config_manager.get_default_mode_tools()
        
        # 获取所有自定义模式（从配置中）
        config = tool_config_manager._load_config()
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

@router.get("/modes/{mode_id}", summary="获取指定模式的工具配置", response_model=Dict[str, Any])
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

@router.put("/modes/{mode_id}", summary="更新指定模式的工具配置", response_model=Dict[str, Any])
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

@router.post("/modes/{mode_id}/reset", summary="重置指定模式的工具配置", response_model=Dict[str, Any])
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

@router.get("/available-tools", summary="获取所有可用的工具", response_model=Dict[str, Any])
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

@router.get("/default-config", summary="获取默认工具配置", response_model=Dict[str, Any])
async def get_default_tool_config():
    """获取默认工具配置"""
    try:
        return {
            "default_mode_tools": tool_config_manager.get_default_mode_tools()
        }
    
    except Exception as e:
        logger.error(f"获取默认工具配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取默认工具配置失败: {str(e)}")