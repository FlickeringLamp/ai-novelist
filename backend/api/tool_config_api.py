##:+ tool_config_api.py
import logging
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.api.decorators import handle_api_errors
from backend.core.ai_agent.core.tool_config_manager import tool_config_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tool-config", tags=["Tool Config"])


class UpdateModeToolConfigRequest(BaseModel):
    """更新模式工具配置请求"""

    enabled_tools: List[str] = Field(..., description="启用的工具列表")


def _build_mode_response(mode: str) -> Dict[str, Any]:
    mode_info = tool_config_manager.get_mode_tool_info(mode)
    enabled_tools = mode_info.get("enabled_tools", []) if isinstance(mode_info, dict) else []

    return {
        "enabled_tools": enabled_tools,
        "tool_categories": tool_config_manager.get_tool_categories(),
        "all_available_tools": tool_config_manager.get_all_available_tools(),
    }


@router.get("/modes/{mode}", summary="获取模式工具配置", response_model=Dict[str, Any])
@handle_api_errors("获取工具配置")
async def get_mode_tool_config(mode: str) -> Dict[str, Any]:
    return _build_mode_response(mode)


@router.put("/modes/{mode}", summary="更新模式工具配置", response_model=Dict[str, Any])
@handle_api_errors("更新工具配置")
async def update_mode_tool_config(mode: str, request: UpdateModeToolConfigRequest) -> Dict[str, Any]:
    tool_config_manager.set_tools_for_mode(mode, request.enabled_tools)
    return _build_mode_response(mode)


@router.post("/modes/{mode}/reset", summary="重置模式工具配置", response_model=Dict[str, Any])
@handle_api_errors("重置工具配置")
async def reset_mode_tool_config(mode: str) -> Dict[str, Any]:
    tool_config_manager.reset_mode_tools(mode)
    return _build_mode_response(mode)
