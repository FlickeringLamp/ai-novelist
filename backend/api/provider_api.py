import logging
from typing import List, Dict
from pydantic import BaseModel, Field
from backend.core.ai_agent.models.multi_model_adapter import MultiModelAdapter
from backend.config import settings
from fastapi import APIRouter

logger = logging.getLogger(__name__)

# 请求模型
class AddFavoriteModelRequest(BaseModel):
    """添加常用模型请求"""
    modelId: str = Field(..., description="模型ID")
    provider: str = Field(..., description="提供商")

class AddProviderRequest(BaseModel):
    """添加提供商请求"""
    name: str = Field(..., description="提供商名称")
    url: str = Field(..., description="API基础URL")
    key: str = Field(..., description="API密钥")

# 创建API路由器
router = APIRouter(prefix="/api/provider", tags=["Provider"])

# API端点

# 所有提供商列表
@router.get("/providers", summary="获取提供商列表", response_model=List[str])
def providers_list():
    """获取所有提供商列表"""
    provider_config = settings.get_config("provider", default={})
    return list(provider_config.keys())



@router.get("/{provider_id}/models", summary="获取指定模型提供商的模型列表", response_model=List[str])
def model_list(provider_id: str):
    """
    获取指定模型提供商的模型列表
    
    Args:
        provider_id: 模型提供商ID
        
    Returns:
        模型列表
    """
    # 获取API密钥和base_url
    api_key = settings.get_config("provider", provider_id, "key", default="")
    base_url = settings.get_config("provider", provider_id, "url", default="")
    
    # 获取模型列表
    models = MultiModelAdapter.get_available_models(provider_id, api_key, base_url)
    
    return models

# 常用模型相关API
@router.get("/favorite-models", summary="获取常用模型列表", response_model=Dict[str, Dict])
async def get_favorite_models():
    """
    获取常用模型列表
    """
    favorite_models = settings.get_config("favoriteModels", default={})
    return favorite_models

@router.post("/favorite-models", summary="添加常用模型", response_model=Dict[str, Dict])
async def add_favorite_model(request: AddFavoriteModelRequest):
    """
    添加模型到常用模型列表
    
    - **modelId**: 模型ID
    - **provider**: 提供商
    """
    # 添加模型到常用列表
    settings.update_config({
        "modelId": request.modelId,
        "provider": request.provider
    }, "favoriteModels", request.modelId)
    
    return settings.get_config("favoriteModels", default={})

@router.delete("/favorite-models", summary="删除常用模型", response_model=Dict[str, Dict])
async def remove_favorite_model(model_id: str):
    """
    从常用模型列表中删除模型
    
    - **modelId**: 模型ID（通过查询参数传递）
    """
    # 从常用列表中删除模型
    settings.delete_config("favoriteModels", model_id)
    
    return settings.get_config("favoriteModels", default={})


@router.post("/custom-providers", summary="添加自定义提供商", response_model=Dict[str, Dict])
async def add_custom_provider(request: AddProviderRequest):
    """
    添加自定义提供商
    
    - **name**: 提供商名称
    - **baseUrl**: API基础URL
    - **apiKey**: API密钥
    """
    provider_config = settings.get_config("provider", default={})
    # 检查名称是否已存在
    if request.name in provider_config:
        return {"error": "名称已被使用"}
    # 添加新的提供商
    settings.update_config({
        "url": request.url,
        "key": request.key
    }, "provider", request.name)
    
    return settings.get_config("provider", default={})

@router.put("/custom-providers/{provider_id}", summary="更新自定义提供商", response_model=Dict[str, Dict])
async def update_custom_provider(provider_id: str, request: AddProviderRequest):
    """
    更新自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    - **name**: 提供商名称
    - **baseUrl**: API基础URL
    - **apiKey**: API密钥
    """
    provider_config = settings.get_config("provider", default={})
    
    # 如果名称改变，检查新名称是否已存在
    if request.name != provider_id and request.name in provider_config:
        return {"error": "新名称已被使用"}
    
    # 删除旧的提供商（如果名称改变）
    if request.name != provider_id:
        settings.delete_config("provider", provider_id)
    
    # 更新提供商
    settings.update_config({
        "url": request.url,
        "key": request.key
    }, "provider", request.name)
    
    return settings.get_config("provider", default={})

@router.delete("/custom-providers/{provider_id}", summary="删除自定义提供商", response_model=Dict[str, Dict])
async def delete_custom_provider(provider_id: str):
    """
    删除自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    """
    # 删除提供商
    settings.delete_config("provider", provider_id)
    
    return settings.get_config("provider", default={})
