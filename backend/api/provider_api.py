import logging
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from backend.config import settings
from fastapi import APIRouter, HTTPException
from backend.core.ai_agent.models.providers import BUILTIN_PROVIDERS

logger = logging.getLogger(__name__)

# 请求模型
class AddFavoriteModelRequest(BaseModel):
    """添加常用模型请求"""
    modelId: str = Field(..., description="模型ID")
    provider: str = Field(..., description="提供商")

class AddProviderRequest(BaseModel):
    """添加提供商请求"""
    name: str = Field(None, description="提供商名称")
    url: str = Field(None, description="API基础URL")
    key: str = Field(None, description="API密钥")
    favoriteModels: List[str] = Field(None, description="常用模型列表")

# 创建API路由器
router = APIRouter(prefix="/api/provider", tags=["Provider"])

# API端点

# 获取内置提供商列表
@router.get("/builtin-providers", summary="获取内置提供商列表", response_model=List[str])
def builtin_providers_list():
    """获取内置提供商列表"""
    return BUILTIN_PROVIDERS

# 所有提供商列表
@router.get("/providers", summary="获取提供商列表", response_model=Dict[str, Dict])
def providers_list():
    """获取所有提供商列表（包含完整信息）"""
    provider_config = settings.get_config("provider", default={})
    return provider_config



@router.get("/{provider_id}/models", summary="获取指定模型提供商的模型列表", response_model=Dict[str, Dict[str, Any]])
def model_list(provider_id: str):
    """
    获取指定模型提供商的模型列表
    
    Args:
        provider_id: 模型提供商ID
        
    Returns:
        包含对话模型、嵌入模型和其他模型的字典
    """
    try:
        # 从配置文件获取provider的favoriteModels
        provider_config = settings.get_config("provider", provider_id, default={})
        favorite_models = provider_config.get("favoriteModels", {})
        
        return favorite_models
    except Exception as e:
        logger.error(f"获取 {provider_id} 模型列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 常用模型相关API
@router.get("/favorite-models", summary="获取常用模型列表", response_model=List[str])
async def get_favorite_models():
    """
    获取常用模型列表
    """
    # 从所有provider中收集favoriteModels
    provider_config = settings.get_config("provider", default={})
    all_favorites = []
    
    for provider_name, provider_data in provider_config.items():
        favorites = provider_data.get("favoriteModels", [])
        all_favorites.extend(favorites)
    
    return all_favorites

@router.post("/favorite-models", summary="添加常用模型", response_model=List[str])
async def add_favorite_model(request: AddFavoriteModelRequest):
    """
    添加模型到常用模型列表
    
    - **modelId**: 模型ID
    """
    # 获取当前provider的favoriteModels列表
    provider_config = settings.get_config("provider", request.provider, default={})
    favorites = provider_config.get("favoriteModels", [])
    
    # 如果模型不在列表中，添加它
    if request.modelId not in favorites:
        favorites.append(request.modelId)
        settings.update_config(favorites, "provider", request.provider, "favoriteModels")
    
    # 返回更新后的所有favorite models
    return await get_favorite_models()

@router.delete("/favorite-models", summary="删除常用模型", response_model=List[str])
async def remove_favorite_model(modelId: str):
    """
    从常用模型列表中删除模型
    
    - **modelId**: 模型ID（通过查询参数传递）
    """
    # 需要先找到这个模型属于哪个provider
    provider_config = settings.get_config("provider", default={})
    
    for provider_name, provider_data in provider_config.items():
        favorites = provider_data.get("favoriteModels", [])
        if modelId in favorites:
            # 从该provider的favoriteModels中删除
            favorites.remove(modelId)
            settings.update_config(favorites, "provider", provider_name, "favoriteModels")
            break
    
    # 返回更新后的所有favorite models
    return await get_favorite_models()


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
        "key": request.key,
        "favoriteModels": []
    }, "provider", request.name)
    
    return settings.get_config("provider", default={})

@router.put("/custom-providers/{provider_id}", summary="更新自定义提供商", response_model=Dict[str, Dict])
async def update_custom_provider(provider_id: str, request: AddProviderRequest):
    """
    更新自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    - **name**: 提供商名称（可选）
    - **url**: API基础URL（可选）
    - **key**: API密钥（可选）
    - **favoriteModels**: 常用模型列表（可选）
    """
    provider_config = settings.get_config("provider", default={})
    # 获取当前提供商的配置
    current_config = provider_config[provider_id]
    
    updated_config = {}
    
    # 更新name（如果提供）
    if request.name is not None:
        updated_config["name"] = request.name
    elif "name" in current_config:
        updated_config["name"] = current_config["name"]
    
    # 更新URL（如果提供）
    if request.url is not None:
        updated_config["url"] = request.url
    elif "url" in current_config:
        updated_config["url"] = current_config["url"]
    
    # 更新Key（如果提供）
    if request.key is not None:
        updated_config["key"] = request.key
    elif "key" in current_config:
        updated_config["key"] = current_config["key"]
    
    # 更新favoriteModels（如果提供）
    if request.favoriteModels is not None:
        updated_config["favoriteModels"] = request.favoriteModels
    elif "favoriteModels" in current_config:
        updated_config["favoriteModels"] = current_config["favoriteModels"]
    
    # 更新提供商配置
    settings.update_config(updated_config, "provider", provider_id)
    
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
