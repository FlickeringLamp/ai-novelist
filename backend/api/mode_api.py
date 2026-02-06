import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.config.config import settings
from backend.config.tools import ALL_AVAILABLE_TOOLS

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/mode", tags=["Mode"])

# 请求模型
class UpdateModeToolConfigRequest(BaseModel):
    """更新模式工具配置请求"""
    enabled_tools: List[str] = Field(..., description="启用的工具列表")

class AddModeRequest(BaseModel):
    """添加自定义模式请求"""
    name: str = Field(..., description="模式名称")

class UpdateModeRequest(BaseModel):
    """更新模式请求"""
    name: Optional[str] = Field(None, description="模式名称")
    prompt: Optional[str] = Field(None, description="提示词")
    temperature: Optional[float] = Field(None, description="温度参数")
    top_p: Optional[float] = Field(None, description="top_p参数")
    max_tokens: Optional[int] = Field(None, description="最大token数")
    additionalInfo: Optional[List[str]] = Field(None, description="额外信息")
    tools: Optional[List[str]] = Field(None, description="工具列表")


@router.get("/tool/modes/{mode_id}", summary="获取指定模式的工具配置", response_model=List[str])
async def get_mode_tool_config(mode_id: str):
    """获取指定模式的工具配置"""
    tool_config = settings.get_config("mode", mode_id, "tools", default=[])
    return tool_config

@router.put("/tool/modes/{mode_id}", summary="更新指定模式的工具配置", response_model=List[str])
async def update_mode_tool_config(mode_id: str, request: UpdateModeToolConfigRequest):
    """
    更新指定模式的工具配置
    
    - **mode_id**: 模式ID
    - **enabled_tools**: 启用的工具列表
    
    Returns:
        List[str]: 启用的工具列表
    """
    # 更新工具配置
    settings.update_config(request.enabled_tools, "mode", mode_id, "tools")
    
    return request.enabled_tools

@router.get("/tool/available-tools", summary="获取所有可用的工具", response_model=Dict[str, Any])
async def get_available_tools():
    """获取所有可用的工具"""
    return ALL_AVAILABLE_TOOLS

@router.get("/modes", summary="获取所有模式", response_model=Dict[str, Dict])
async def get_modes():
    """获取所有模式列表（包含完整信息）"""
    mode_config = settings.get_config("mode", default={})
    return mode_config

@router.post("/custom-modes", summary="添加自定义模式", response_model=Dict[str, Dict])
async def add_custom_mode(request: AddModeRequest):
    """
    添加自定义模式，默认第一次name设置为id，后续可以更改用于显示的name，id保持不变
    
    - **name**: 模式名称
    """
    mode_config = settings.get_config("mode", default={})
    # 检查名称是否已存在
    if request.name in mode_config:
        return {"error": "名称已被使用"}
    # 添加新的模式
    settings.update_config({
        "name": request.name,
        "builtin": False,
        "prompt": "",
        "temperature": 0.7,
        "top_p": 0.7,
        "max_tokens": 4096,
        "additionalInfo": [],
        "tools": []
    }, "mode", request.name)
    
    return settings.get_config("mode", default={})

@router.put("/custom-modes/{mode_id}", summary="更新自定义模式", response_model=Dict[str, Dict])
async def update_custom_mode(mode_id: str, request: UpdateModeRequest):
    """
    更新自定义模式
    
    - **mode_id**: 模式ID（路径参数）
    - **name**: 模式名称（可选）
    - **prompt**: 提示词（可选）
    - **temperature**: 温度参数（可选）
    - **top_p**: top_p参数（可选）
    - **max_tokens**: 最大token数（可选）
    - **additionalInfo**: 额外信息（可选）
    - **tools**: 工具列表（可选）
    """
    mode_config = settings.get_config("mode", default={})
    # 获取当前模式的配置
    current_config = mode_config[mode_id]
    
    updated_config = {}
    
    # 更新name
    if request.name is not None:
        updated_config["name"] = request.name
    elif "name" in current_config:
        updated_config["name"] = current_config["name"]
    
    # 更新prompt
    if request.prompt is not None:
        updated_config["prompt"] = request.prompt
    elif "prompt" in current_config:
        updated_config["prompt"] = current_config["prompt"]
    
    # 更新temperature
    if request.temperature is not None:
        updated_config["temperature"] = request.temperature
    elif "temperature" in current_config:
        updated_config["temperature"] = current_config["temperature"]
    
    # 更新top_p
    if request.top_p is not None:
        updated_config["top_p"] = request.top_p
    elif "top_p" in current_config:
        updated_config["top_p"] = current_config["top_p"]
    
    # 更新max_tokens
    if request.max_tokens is not None:
        updated_config["max_tokens"] = request.max_tokens
    elif "max_tokens" in current_config:
        updated_config["max_tokens"] = current_config["max_tokens"]
    
    # 更新additionalInfo
    if request.additionalInfo is not None:
        updated_config["additionalInfo"] = request.additionalInfo
    elif "additionalInfo" in current_config:
        updated_config["additionalInfo"] = current_config["additionalInfo"]
    
    # 更新tools
    if request.tools is not None:
        updated_config["tools"] = request.tools
    elif "tools" in current_config:
        updated_config["tools"] = current_config["tools"]
    
    # 保留builtin字段
    if "builtin" in current_config:
        updated_config["builtin"] = current_config["builtin"]
    
    # 更新模式配置
    settings.update_config(updated_config, "mode", mode_id)
    
    return settings.get_config("mode", default={})

@router.delete("/custom-modes/{mode_id}", summary="删除自定义模式", response_model=Dict[str, Dict])
async def delete_custom_mode(mode_id: str):
    """
    删除自定义模式
    
    - **mode_id**: 模式ID（路径参数）
    """
    # 删除模式
    settings.delete_config("mode", mode_id)
    
    return settings.get_config("mode", default={})
