import logging
from backend.ai_agent.models.multi_model_adapter import MultiModelAdapter
from backend.ai_agent.config import ai_settings
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from typing import Optional, Any
from backend.ai_agent.models.providers_list import BUILTIN_PROVIDERS

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/provider")

# 自定义提供商相关API
class CustomProviderRequest(BaseModel):
    """自定义提供商请求模型"""
    name: str
    baseUrl: str
    apiKey: str = ""

class CustomProviderResponse(BaseModel):
    """自定义提供商响应模型"""
    success: bool
    message: str
    data: Optional[Any] = None

class ProvidersListResponse(BaseModel):
    """提供商列表响应模型"""
    success: bool
    message: str
    data: Optional[list] = None

# 常用模型相关API
class FavoriteModelsRequest(BaseModel):
    """常用模型请求模型"""
    modelId: str
    provider: str

class FavoriteModelsResponse(BaseModel):
    """常用模型响应模型"""
    success: bool
    message: str
    data: Optional[Any] = None

class ModelsListResponse(BaseModel):
    """模型列表响应模型"""
    success: bool
    message: str
    data: Optional[dict] = None

# API端点

# 所有提供商列表
@router.get("/providers", response_model=ProvidersListResponse, summary="获取提供商列表")
def providers_list():
    """获取所有提供商列表（包括内置和自定义）"""
    
    # 获取自定义提供商
    custom_providers = ai_settings._get_config("customProviders", [])
    custom_provider_names = [provider.get("name") for provider in custom_providers if provider.get("name")]
    
    # 合并内置提供商和自定义提供商
    builtin_provider_names = list(BUILTIN_PROVIDERS.keys())
    all_providers = builtin_provider_names + custom_provider_names
    
    return ProvidersListResponse(
        success=True,
        message="获取提供商列表成功",
        data=all_providers
    )



@router.get("/{provider_id}/models", response_model=ModelsListResponse, summary="获取指定模型提供商的模型列表")
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
        
        return ModelsListResponse(
            success=True,
            message="获取模型列表成功",
            data={
                "models": models,
                "count": len(models)
            }
        )
    except Exception as e:
        logger.error(f"获取提供商 {provider_id} 的模型列表失败: {e}")
        # 尝试从错误信息中提取HTTP状态码
        error_message = str(e)
        status_code = 500  # 默认状态码
        
        # 检查错误信息中是否包含HTTP状态码
        import re
        http_status_match = re.search(r'HTTP (\d{3})', error_message)
        if http_status_match:
            status_code = int(http_status_match.group(1))
            # 提取纯错误信息（去掉HTTP状态码部分）
            error_message = re.sub(r' \(HTTP \d{3}\).*$', '', error_message)
        
        raise HTTPException(status_code=status_code, detail=error_message)

# 常用模型相关API
@router.get("/favorite-models", response_model=FavoriteModelsResponse, summary="获取常用模型列表")
async def get_favorite_models():
    """
    获取常用模型列表
    """
    try:
        config = ai_settings.get_all_config()
        favorite_models = config.get("favoriteModels", {})
        return FavoriteModelsResponse(
            success=True,
            message="获取常用模型列表成功",
            data=favorite_models
        )
        
    except Exception as e:
        logger.error(f"获取常用模型列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取常用模型列表失败: {str(e)}")

@router.post("/favorite-models", response_model=FavoriteModelsResponse, summary="添加常用模型")
async def add_favorite_model(request: FavoriteModelsRequest):
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
        return FavoriteModelsResponse(
            success=True,
            message="添加常用模型成功",
            data=config["favoriteModels"]
        )
        
    except Exception as e:
        logger.error(f"添加常用模型失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加常用模型失败: {str(e)}")

@router.delete("/favorite-models", response_model=FavoriteModelsResponse, summary="删除常用模型")
async def remove_favorite_model(modelId: str):
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
        if modelId in config["favoriteModels"]:
            del config["favoriteModels"][modelId]
            ai_settings.update_config(config)
            
            return FavoriteModelsResponse(
                success=True,
                message="删除常用模型成功",
                data=config["favoriteModels"]
            )
        else:
            return FavoriteModelsResponse(
                success=False,
                message="模型不在常用列表中",
                data=config["favoriteModels"]
            )
        
    except Exception as e:
        logger.error(f"删除常用模型失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除常用模型失败: {str(e)}")


@router.post("/custom-providers", response_model=CustomProviderResponse, summary="添加自定义提供商")
async def add_custom_provider(request: CustomProviderRequest):
    """
    添加自定义提供商
    
    - **id**: 提供商唯一标识
    - **name**: 提供商名称
    - **baseUrl**: API基础URL
    - **apiKey**: API密钥
    - **description**: 提供商描述
    """
    try:
        config = ai_settings.get_all_config()
        
        # 初始化customProviders列表（如果不存在）
        if "customProviders" not in config:
            config["customProviders"] = []
        
        # 检查提供商名称是否已存在
        existing_names = [provider.get("name") for provider in config["customProviders"]]
        if request.name in existing_names:
            return CustomProviderResponse(
                success=False,
                message=f"提供商名称 '{request.name}' 已存在",
                data=config["customProviders"]
            )
        
        # 添加新的自定义提供商
        new_provider = {
            "name": request.name,
            "baseUrl": request.baseUrl,
            "apiKey": request.apiKey
        }
        
        config["customProviders"].append(new_provider)
        ai_settings.update_config(config)
        
        return CustomProviderResponse(
            success=True,
            message="添加自定义提供商成功",
            data=config["customProviders"]
        )
        
    except Exception as e:
        logger.error(f"添加自定义提供商失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加自定义提供商失败: {str(e)}")

@router.put("/custom-providers/{provider_id}", response_model=CustomProviderResponse, summary="更新自定义提供商")
async def update_custom_provider(provider_id: str, request: CustomProviderRequest):
    """
    更新自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    - **id**: 提供商唯一标识
    - **name**: 提供商名称
    - **baseUrl**: API基础URL
    - **apiKey**: API密钥
    - **description**: 提供商描述
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
            return CustomProviderResponse(
                success=False,
                message=f"提供商名称 '{provider_id}' 不存在",
                data=config["customProviders"]
            )
        
        ai_settings.update_config(config)
        
        return CustomProviderResponse(
            success=True,
            message="更新自定义提供商成功",
            data=config["customProviders"]
        )
        
    except Exception as e:
        logger.error(f"更新自定义提供商失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新自定义提供商失败: {str(e)}")

@router.delete("/custom-providers/{provider_id}", response_model=CustomProviderResponse, summary="删除自定义提供商")
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
            return CustomProviderResponse(
                success=False,
                message=f"提供商名称 '{provider_id}' 不存在",
                data=config["customProviders"]
            )
        
        ai_settings.update_config(config)
        
        return CustomProviderResponse(
            success=True,
            message="删除自定义提供商成功",
            data=config["customProviders"]
        )
        
    except Exception as e:
        logger.error(f"删除自定义提供商失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除自定义提供商失败: {str(e)}")