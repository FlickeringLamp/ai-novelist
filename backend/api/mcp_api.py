import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.ai_agent.mcp.mcp_manager import (
    get_all_mcp_servers,
    add_mcp_server,
    update_mcp_server,
    delete_mcp_server,
    get_mcp_tools
)

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/mcp", tags=["MCP"])

# 请求模型
class MCPServerConfig(BaseModel):
    """MCP服务器配置"""
    name: str = Field(..., description="服务器名称")
    description: str = Field(default="", description="服务器描述")
    baseUrl: str = Field(default="", description="基础URL")
    isActive: bool = Field(default=True, description="是否激活")
    transport: str = Field(default="stdio", description="传输类型 (stdio/http)")
    command: Optional[str] = Field(None, description="命令（stdio类型）")
    args: Optional[List[str]] = Field(default_factory=list, description="命令参数（stdio类型）")
    env: Optional[Dict[str, str]] = Field(default_factory=dict, description="环境变量")

class AddMCPServerRequest(BaseModel):
    """添加MCP服务器请求"""
    server_id: str = Field(..., description="服务器ID")
    config: MCPServerConfig = Field(..., description="服务器配置")

class UpdateMCPServerRequest(BaseModel):
    """更新MCP服务器请求"""
    server_id: str = Field(..., description="服务器ID")
    config: Dict[str, Any] = Field(..., description="要更新的配置字段")


@router.get("/servers", summary="获取所有MCP服务器配置", response_model=Dict[str, Dict])
async def get_mcp_servers():
    """
    获取所有MCP服务器配置
    
    Returns:
        Dict[str, Dict]: 所有MCP服务器配置
    """
    return get_all_mcp_servers()


@router.post("/servers", summary="添加新的MCP服务器配置", response_model=Dict[str, Dict])
async def add_server(request: AddMCPServerRequest):
    """
    添加新的MCP服务器配置
    
    - **server_id**: MCP服务器ID
    - **config**: MCP服务器配置
    
    Returns:
        Dict[str, Dict]: 更新后的所有MCP服务器配置
    """
    try:
        config_dict = request.config.model_dump()
        return add_mcp_server(request.server_id, config_dict)
    except Exception as e:
        logger.error(f"添加MCP服务器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/servers/{server_id}", summary="更新指定的MCP服务器配置", response_model=Dict[str, Dict])
async def update_server(server_id: str, request: UpdateMCPServerRequest):
    """
    更新指定的MCP服务器配置
    
    - **server_id**: MCP服务器ID
    - **config**: 要更新的配置字段（只更新提供的字段）
    
    Returns:
        Dict[str, Dict]: 更新后的所有MCP服务器配置
    """
    try:
        return update_mcp_server(server_id, request.config)
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
        return delete_mcp_server(server_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"删除MCP服务器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools", summary="获取MCP工具列表", response_model=Dict[str, Any])
async def get_mcp_tools_list():
    """
    获取MCP工具列表
    
    Returns:
        Dict[str, Any]: MCP工具字典
    """
    try:
        tools = await get_mcp_tools()
        return tools
    except Exception as e:
        logger.error(f"获取MCP工具失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
