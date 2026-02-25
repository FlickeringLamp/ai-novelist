"""MCP服务器管理API"""
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.config.config import settings
from backend.config.mcp_servers import MCPServerConfigManager

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/mcp", tags=["MCP"])

# 请求模型
class MCPServerConfigRequest(BaseModel):
    """MCP服务器配置请求"""
    name: str = Field(..., description="服务器名称")
    command: str = Field(..., description="启动命令")
    args: List[str] = Field(default_factory=list, description="命令参数")
    transport: str = Field(default="stdio", description="传输方式")
    enabled: bool = Field(default=True, description="是否启用")
    description: str = Field(default="", description="服务器描述")


class MCPServerUpdateRequest(BaseModel):
    """MCP服务器更新请求"""
    command: Optional[str] = Field(None, description="启动命令")
    args: Optional[List[str]] = Field(None, description="命令参数")
    transport: Optional[str] = Field(None, description="传输方式")
    enabled: Optional[bool] = Field(None, description="是否启用")
    description: Optional[str] = Field(None, description="服务器描述")


@router.get("/servers", summary="获取所有MCP服务器配置", response_model=List[Dict[str, Any]])
async def get_mcp_servers():
    """
    获取所有MCP服务器配置列表
    
    Returns:
        List[Dict]: MCP服务器配置列表
    """
    config_manager = MCPServerConfigManager(settings)
    return config_manager.get_server_list()


@router.get("/servers/{name}", summary="获取指定MCP服务器配置", response_model=Dict[str, Any])
async def get_mcp_server(name: str):
    """
    获取指定MCP服务器的配置
    
    - **name**: 服务器名称
    """
    config_manager = MCPServerConfigManager(settings)
    server = config_manager.get_server(name)
    
    if not server:
        raise HTTPException(status_code=404, detail=f"MCP服务器 '{name}' 不存在")
    
    return server


@router.post("/servers", summary="添加MCP服务器", response_model=Dict[str, Any])
async def add_mcp_server(request: MCPServerConfigRequest):
    """
    添加新的MCP服务器配置
    
    - **name**: 服务器名称
    - **command**: 启动命令
    - **args**: 命令参数
    - **transport**: 传输方式（stdio或sse）
    - **enabled**: 是否启用
    - **description**: 服务器描述
    """
    config_manager = MCPServerConfigManager(settings)
    
    # 检查服务器是否已存在
    existing_server = config_manager.get_server(request.name)
    if existing_server:
        raise HTTPException(status_code=400, detail=f"MCP服务器 '{request.name}' 已存在")
    
    # 添加服务器配置
    config = {
        "name": request.name,
        "command": request.command,
        "args": request.args,
        "transport": request.transport,
        "enabled": request.enabled,
        "description": request.description
    }
    config_manager.add_server(request.name, config)
    
    logger.info(f"添加MCP服务器: {request.name}")
    return config


@router.put("/servers/{name}", summary="更新MCP服务器配置", response_model=Dict[str, Any])
async def update_mcp_server(name: str, request: MCPServerUpdateRequest):
    """
    更新MCP服务器配置
    
    - **name**: 服务器名称
    - **command**: 启动命令（可选）
    - **args**: 命令参数（可选）
    - **transport**: 传输方式（可选）
    - **enabled**: 是否启用（可选）
    - **description**: 服务器描述（可选）
    """
    config_manager = MCPServerConfigManager(settings)
    
    # 检查服务器是否存在
    existing_server = config_manager.get_server(name)
    if not existing_server:
        raise HTTPException(status_code=404, detail=f"MCP服务器 '{name}' 不存在")
    
    # 构建更新配置
    update_config = {}
    if request.command is not None:
        update_config["command"] = request.command
    if request.args is not None:
        update_config["args"] = request.args
    if request.transport is not None:
        update_config["transport"] = request.transport
    if request.enabled is not None:
        update_config["enabled"] = request.enabled
    if request.description is not None:
        update_config["description"] = request.description
    
    # 更新服务器配置
    config_manager.update_server(name, update_config)
    
    logger.info(f"更新MCP服务器: {name}")
    return config_manager.get_server(name)


@router.delete("/servers/{name}", summary="删除MCP服务器", response_model=Dict[str, str])
async def delete_mcp_server(name: str):
    """
    删除MCP服务器配置
    
    - **name**: 服务器名称
    """
    config_manager = MCPServerConfigManager(settings)
    
    # 检查服务器是否存在
    existing_server = config_manager.get_server(name)
    if not existing_server:
        raise HTTPException(status_code=404, detail=f"MCP服务器 '{name}' 不存在")
    
    # 删除服务器配置
    config_manager.remove_server(name)
    
    logger.info(f"删除MCP服务器: {name}")
    return {"message": f"MCP服务器 '{name}' 已删除"}


@router.post("/servers/{name}/enable", summary="启用MCP服务器", response_model=Dict[str, Any])
async def enable_mcp_server(name: str):
    """
    启用指定的MCP服务器
    
    - **name**: 服务器名称
    """
    config_manager = MCPServerConfigManager(settings)
    
    # 检查服务器是否存在
    existing_server = config_manager.get_server(name)
    if not existing_server:
        raise HTTPException(status_code=404, detail=f"MCP服务器 '{name}' 不存在")
    
    # 启用服务器
    config_manager.enable_server(name)
    
    logger.info(f"启用MCP服务器: {name}")
    return config_manager.get_server(name)


@router.post("/servers/{name}/disable", summary="禁用MCP服务器", response_model=Dict[str, Any])
async def disable_mcp_server(name: str):
    """
    禁用指定的MCP服务器
    
    - **name**: 服务器名称
    """
    config_manager = MCPServerConfigManager(settings)
    
    # 检查服务器是否存在
    existing_server = config_manager.get_server(name)
    if not existing_server:
        raise HTTPException(status_code=404, detail=f"MCP服务器 '{name}' 不存在")
    
    # 禁用服务器
    config_manager.disable_server(name)
    
    logger.info(f"禁用MCP服务器: {name}")
    return config_manager.get_server(name)
