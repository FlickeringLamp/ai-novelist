import logging
from typing import List, Dict
from pydantic import BaseModel, Field
from backend.ai_agent.models.multi_model_adapter import MultiModelAdapter
from backend.config.config import ai_settings
from fastapi import APIRouter, HTTPException
from backend.ai_agent.models.providers_list import BUILTIN_PROVIDERS

logger = logging.getLogger(__name__)

# 请求模型
class AddFavoriteModelRequest(BaseModel):
    """添加常用模型请求"""
    modelId: str = Field(..., description="模型ID")
    provider: str = Field(..., description="提供商")

class AddCustomProviderRequest(BaseModel):
    """添加自定义提供商请求"""
    name: str = Field(..., description="提供商名称")
    baseUrl: str = Field(..., description="API基础URL")
    apiKey: str = Field(default="", description="API密钥")

class UpdateCustomProviderRequest(BaseModel):
    """更新自定义提供商请求"""
    name: str = Field(..., description="提供商名称")
    baseUrl: str = Field(..., description="API基础URL")
    apiKey: str = Field(default="", description="API密钥")

# 创建API路由器
router = APIRouter(prefix="/api/provider")

# API端点

# 所有提供商列表
@router.get("/providers", summary="获取提供商列表", response_model=List[str])
def providers_list():
    """获取所有提供商列表（包括内置和自定义）"""
    
    # 获取自定义提供商
    custom_providers = ai_settings.get_config("customProviders", [])
    custom_provider_names = [provider.get("name") for provider in custom_providers if provider.get("name")]
    
    # 合并内置提供商和自定义提供商
    builtin_provider_names = list(BUILTIN_PROVIDERS.keys())
    all_providers = builtin_provider_names + custom_provider_names
    
    return all_providers



@router.get("/{provider_id}/models", summary="获取指定模型提供商的模型列表", response_model=List[str])
def model_list(provider_id: str):
    """
    获取指定模型提供商的模型列表
    
    Args:
        provider_id: 模型提供商ID
        
    Returns:
        模型列表
    """
    try:
        # 获取API密钥和base_url
        api_key = ai_settings.get_api_key_for_provider(provider_id)
        base_url = ai_settings.get_base_url_for_provider(provider_id)
        
        # 获取模型列表
        models = MultiModelAdapter.get_available_models(provider_id, api_key, base_url)
        
        return models
    except Exception as e:
        logger.error(f"获取提供商 {provider_id} 的模型列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 常用模型相关API
@router.get("/favorite-models", summary="获取常用模型列表", response_model=Dict[str, Dict])
async def get_favorite_models():
    """
    获取常用模型列表
    """
    try:
        config = ai_settings.get_all_config()
        favorite_models = config.get("favoriteModels", {})
        return favorite_models
        
    except Exception as e:
        logger.error(f"获取常用模型列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取常用模型列表失败: {str(e)}")

@router.post("/favorite-models", summary="添加常用模型", response_model=Dict[str, Dict])
async def add_favorite_model(request: AddFavoriteModelRequest):
    """
    添加模型到常用模型列表
    
    - **modelId**: 模型ID
    - **provider**: 提供商
    """
    try:
        config = ai_settings.get_all_config()
        
        # 初始化favoriteModels字典（如果不存在）
        if "favoriteModels" not in config:
            config["favoriteModels"] = {}
        
        # 添加模型到常用列表
        config["favoriteModels"][request.modelId] = {
            "modelId": request.modelId,
            "provider": request.provider
        }
        
        ai_settings.update_config(config)
        return config["favoriteModels"]
        
    except Exception as e:
        logger.error(f"添加常用模型失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加常用模型失败: {str(e)}")

@router.delete("/favorite-models", summary="删除常用模型", response_model=Dict[str, Dict])
async def remove_favorite_model(model_id: str):
    """
    从常用模型列表中删除模型
    
    - **modelId**: 模型ID（通过查询参数传递）
    """
    try:
        config = ai_settings.get_all_config()
        
        # 初始化favoriteModels字典（如果不存在）
        if "favoriteModels" not in config:
            config["favoriteModels"] = {}
        
        # 从常用列表中删除模型
        if model_id in config["favoriteModels"]:
            del config["favoriteModels"][model_id]
            ai_settings.update_config(config)
            
            return config["favoriteModels"]
        else:
            return config["favoriteModels"]
        
    except Exception as e:
        logger.error(f"删除常用模型失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除常用模型失败: {str(e)}")


@router.post("/custom-providers", summary="添加自定义提供商", response_model=List[Dict])
async def add_custom_provider(request: AddCustomProviderRequest):
    """
    添加自定义提供商
    
    - **name**: 提供商名称
    - **baseUrl**: API基础URL
    - **apiKey**: API密钥
    """
    try:
        config = ai_settings.get_all_config()
        
        # 初始化customProviders列表（如果不存在）
        if "customProviders" not in config:
            config["customProviders"] = []
        
        # 检查提供商名称是否已存在
        existing_names = [provider.get("name") for provider in config["customProviders"]]
        if request.name in existing_names:
            return config["customProviders"]
        
        # 添加新的自定义提供商
        new_provider = {
            "name": request.name,
            "baseUrl": request.baseUrl,
            "apiKey": request.apiKey
        }
        
        config["customProviders"].append(new_provider)
        ai_settings.update_config(config)
        
        return config["customProviders"]
        
    except Exception as e:
        logger.error(f"添加自定义提供商失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加自定义提供商失败: {str(e)}")

@router.put("/custom-providers/{provider_id}", summary="更新自定义提供商", response_model=List[Dict])
async def update_custom_provider(provider_id: str, request: UpdateCustomProviderRequest):
    """
    更新自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    - **name**: 提供商名称
    - **baseUrl**: API基础URL
    - **apiKey**: API密钥
    """
    try:
        config = ai_settings.get_all_config()
        
        # 初始化customProviders列表（如果不存在）
        if "customProviders" not in config:
            config["customProviders"] = []
        
        # 查找并更新提供商
        provider_found = False
        for i, provider in enumerate(config["customProviders"]):
            if provider.get("name") == provider_id:
                config["customProviders"][i] = {
                    "name": request.name,
                    "baseUrl": request.baseUrl,
                    "apiKey": request.apiKey
                }
                provider_found = True
                break
        
        if not provider_found:
            return config["customProviders"]
        
        ai_settings.update_config(config)
        
        return config["customProviders"]
        
    except Exception as e:
        logger.error(f"更新自定义提供商失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新自定义提供商失败: {str(e)}")

@router.delete("/custom-providers/{provider_id}", summary="删除自定义提供商", response_model=List[Dict])
async def delete_custom_provider(provider_id: str):
    """
    删除自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    """
    try:
        config = ai_settings.get_all_config()
        
        # 初始化customProviders列表（如果不存在）
        if "customProviders" not in config:
            config["customProviders"] = []
        
        # 查找并删除提供商
        provider_found = False
        for i, provider in enumerate(config["customProviders"]):
            if provider.get("name") == provider_id:
                del config["customProviders"][i]
                provider_found = True
                break
        
        if not provider_found:
            return config["customProviders"]
        
        ai_settings.update_config(config)
        
        return config["customProviders"]
        
    except Exception as e:
        logger.error(f"删除自定义提供商失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除自定义提供商失败: {str(e)}")