import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.ai_agent.mcp.mcp_manager import (
    get_mcp_data,
    save_mcp_server,
    delete_mcp_server,
    get_mcp_server_tools,
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
    envValues: Optional[Dict[str, str]] = Field(default_factory=dict, description="环境变量值字典")
    headers: Optional[Dict[str, str]] = Field(default_factory=dict, description="请求头（用于HTTP/SSE传输）")

class SaveMCPServerRequest(BaseModel):
    """保存MCP服务器请求（添加或更新）"""
    server_id: str = Field(..., description="服务器ID")
    config: MCPServerConfig = Field(..., description="服务器配置")


@router.get("/servers", summary="获取所有MCP服务器配置", response_model=Dict[str, Dict])
async def get_mcp_servers():
    return await get_mcp_data()


@router.get("/servers/{server_id}/tools", summary="获取指定MCP服务器的工具列表", response_model=Dict[str, Any])
async def get_server_tools(server_id: str):
    try:
        return await get_mcp_server_tools(server_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取服务器 {server_id} 的工具失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/servers", summary="添加或更新MCP服务器配置", response_model=Dict[str, Dict])
async def save_server(request: SaveMCPServerRequest):
    try:
        config_dict = request.config.model_dump()
        print("config_dict:",config_dict)
        return await save_mcp_server(request.server_id, config_dict)
    except Exception as e:
        logger.error(f"保存MCP服务器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/servers/{server_id}", summary="删除指定的MCP服务器配置", response_model=Dict[str, Dict])
async def delete_server(server_id: str):
    try:
        return await delete_mcp_server(server_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"删除MCP服务器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
