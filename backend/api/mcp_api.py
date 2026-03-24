import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.ai_agent.mcp.mcp_manager import (
    get_all_mcp_servers,
    add_mcp_server,
    update_mcp_server,
    delete_mcp_server,
    get_mcp_tools,
    get_all_mcp_tools_by_server,
)
from backend.settings.settings import settings

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/mcp", tags=["MCP"])

# 请求模型
class MCPServerConfig(BaseModel):
    """MCP服务器配置"""
    name: str = Field(..., description="服务器名称")
    description: str = Field(default="", description="服务器描述")
    url: str = Field(default="", description="服务器URL（用于HTTP/SSE传输）")
    isActive: bool = Field(default=True, description="是否激活")
    transport: str = Field(default="stdio", description="传输类型 (stdio/http/sse)")
    command: Optional[str] = Field(None, description="命令（stdio类型）")
    args: Optional[List[str]] = Field(default_factory=list, description="命令参数（stdio类型）")
    env: Optional[List[str]] = Field(default_factory=list, description="环境变量名列表")
    headers: Optional[Dict[str, str]] = Field(default_factory=dict, description="请求头（用于HTTP/SSE传输）")

class AddMCPServerRequest(BaseModel):
    """添加MCP服务器请求"""
    server_id: str = Field(..., description="服务器ID")
    config: MCPServerConfig = Field(..., description="服务器配置")

class UpdateMCPServerRequest(BaseModel):
    """更新MCP服务器请求"""
    server_id: str = Field(..., description="服务器ID")
    config: Dict[str, Any] = Field(..., description="要更新的配置字段")


def _enrich_server_with_env_values(server_config: dict) -> dict:
    """
    为服务器配置添加环境变量值
    
    Args:
        server_config: 原始服务器配置
        
    Returns:
        dict: 包含 envValues 字段的服务器配置
    """
    result = server_config.copy()
    env_keys = server_config.get("env", [])
    
    # 获取所有环境变量的值
    env_values = {}
    if isinstance(env_keys, list):
        for key in env_keys:
            value = settings.env_manager.get_api_key(key)
            if value is not None:
                env_values[key] = value
    
    result["envValues"] = env_values
    return result


@router.get("/servers", summary="获取所有MCP服务器配置", response_model=Dict[str, Dict])
async def get_mcp_servers():
    """
    获取所有MCP服务器配置
    
    Returns:
        Dict[str, Dict]: 所有MCP服务器配置（包含 envValues 字段）
    """
    servers = get_all_mcp_servers()
    # 为每个服务器添加环境变量值
    result = {}
    for server_id, server_config in servers.items():
        result[server_id] = _enrich_server_with_env_values(server_config)
    return result


@router.post("/servers", summary="添加新的MCP服务器配置", response_model=Dict[str, Dict])
async def add_server(request: AddMCPServerRequest):
    """
    添加新的MCP服务器配置
    
    - **server_id**: MCP服务器ID
    - **settings**: MCP服务器配置
    
    Returns:
        Dict[str, Dict]: 更新后的所有MCP服务器配置
    """
    try:
        config_dict = request.config.model_dump()
        return await add_mcp_server(request.server_id, config_dict)
    except Exception as e:
        logger.error(f"添加MCP服务器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/servers/{server_id}", summary="更新指定的MCP服务器配置", response_model=Dict[str, Dict])
async def update_server(server_id: str, request: UpdateMCPServerRequest):
    """
    更新指定的MCP服务器配置
    
    - **server_id**: MCP服务器ID
    - **settings**: 要更新的配置字段（只更新提供的字段）
    
    Returns:
        Dict[str, Dict]: 更新后的所有MCP服务器配置（包含 envValues 字段）
    """
    try:
        # 处理 envValues 字段（如果有的话，将其保存到环境变量）
        if "envValues" in request.config:
            env_values = request.config.pop("envValues")
            for key, value in env_values.items():
                settings.env_manager.set_api_key(key, value)
        
        updated_servers = update_mcp_server(server_id, request.config)
        
        # 返回包含环境变量值的配置
        result = {}
        for sid, sconfig in updated_servers.items():
            result[sid] = _enrich_server_with_env_values(sconfig)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"更新MCP服务器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/servers/{server_id}", summary="删除指定的MCP服务器配置", response_model=Dict[str, Dict])
async def delete_server(server_id: str):
    """
    删除指定的MCP服务器配置
    
    - **server_id**: MCP服务器ID
    
    Returns:
        Dict[str, Dict]: 更新后的所有MCP服务器配置
    """
    try:
        return await delete_mcp_server(server_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"删除MCP服务器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools", summary="获取MCP工具字典", response_model=Dict[str, Dict])
async def get_tools(server_id: Optional[str] = None):
    """
    获取MCP工具字典
    
    - **server_id**: 可选的服务器ID，如果提供则只返回该服务器的工具
    
    Returns:
        Dict[str, Dict]: MCP工具字典
    """
    try:
        return await get_mcp_tools(server_id)
    except Exception as e:
        logger.error(f"获取MCP工具失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools/all", summary="获取所有活跃MCP服务器的工具", response_model=Dict[str, Dict])
async def get_all_tools():
    """
    获取所有活跃MCP服务器的工具，按服务器ID组织
    
    Returns:
        Dict[str, Dict]: 按服务器ID组织的工具字典，每个服务器包含tools和error字段
    """
    try:
        return await get_all_mcp_tools_by_server()
    except Exception as e:
        logger.error(f"获取所有MCP工具失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
