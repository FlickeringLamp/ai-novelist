import logging
import uuid
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from backend.settings.settings import settings
from fastapi import APIRouter, HTTPException
from backend.ai_agent.models import MultiModelAdapter

logger = logging.getLogger(__name__)

# 请求模型
class AddFavoriteModelRequest(BaseModel):
    """添加常用模型请求"""
    modelId: str = Field(..., description="模型ID")
    provider: str = Field(..., description="提供商")
    modelType: str = Field(..., description="模型类型: chat/embedding/other")
    context: int = Field(32000, description="上下文长度（chat模型）或max-tokens（embedding模型）")
    dimensions: int = Field(1024, description="嵌入维度（仅embedding模型）")

class RemoveFavoriteModelRequest(BaseModel):
    """删除常用模型请求"""
    modelId: str = Field(..., description="模型ID")
    provider: str = Field(..., description="提供商")
    modelType: str = Field(..., description="模型类型: chat/embedding/other")

class AddProviderRequest(BaseModel):
    """添加自定义提供商"""
    name: str = Field(..., description="提供商名")

class UpdateProviderRequest(BaseModel):
    """更新提供商请求"""
    name: str = Field(None, description="提供商名称")
    url: str = Field(None, description="API基础URL")
    key: str = Field(None, description="API密钥")
    favoriteModels: Dict[str, Dict[str, Any]] = Field(None, description="常用模型列表")
    enable: bool = Field(None, description="是否启用")

class SetApiKeyRequest(BaseModel):
    """设置API KEY请求"""
    key: str = Field(..., description="API密钥")

class GetApiKeyResponse(BaseModel):
    """获取API KEY响应"""
    provider: str = Field(..., description="提供商ID")
    hasKey: bool = Field(..., description="是否已设置API KEY")
    keyHint: str = Field("", description="API KEY的提示信息（如 sk-...xxxx）")

# 创建API路由器
router = APIRouter(prefix="/api/provider", tags=["Provider"])


def _get_provider_config(provider_id: str) -> tuple[dict, str]:
    """
    获取提供商配置和 env_key 的辅助函数
    
    Returns:
        (provider_config, env_key)
    """
    provider_config = settings.get_config("provider", provider_id, default={})
    if not provider_config:
        raise HTTPException(status_code=404, detail=f"提供商 {provider_id} 不存在")
    
    env_key = provider_config.get("env_key")
    return provider_config, env_key


# API端点

# 所有提供商列表
@router.get("/providers", summary="获取提供商列表", response_model=Dict[str, Dict])
def providers_list():
    """获取所有提供商列表（包含完整信息，key 从 .env 读取）"""
    provider_config = settings.get_config("provider", default={})
    
    # 从 .env 读取 API KEY 并合并到返回数据中
    result = {}
    for provider_id, config in provider_config.items():
        # 深拷贝配置，避免修改原始数据
        config_copy = dict(config)
        # 从 .env 读取 key
        api_key = settings.get_provider_key(provider_id) or ""
        config_copy["key"] = api_key
        result[provider_id] = config_copy
    
    return result



@router.get("/{provider_id}/models", summary="获取指定模型提供商的模型列表", response_model=List[str])
def model_list(provider_id: str):
    """
    获取指定模型提供商的模型列表
    
    Args:
        provider_id: 模型提供商ID
        
    Returns:
        所有模型列表
    """
    try:
        provider_config, env_key = _get_provider_config(provider_id)
        
        # 获取provider的API配置
        api_key = settings.get_provider_key(provider_id) or ""
        base_url = provider_config.get("url", "")
        
        # 调用get_available_models方法获取在线模型列表
        models = MultiModelAdapter.get_available_models(provider_id, api_key, base_url)
        
        # 将模型列表转换为字典格式返回
        return models
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取 {provider_id} 模型列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/favorite-models/add", summary="添加常用模型", response_model=Dict[str, Dict])
async def add_favorite_model(request: AddFavoriteModelRequest):
    """
    添加模型到常用模型列表
    
    - **modelId**: 模型ID
    - **provider**: 提供商ID
    - **modelType**: 模型类型（chat/embedding/other）
    - **context**: 上下文长度（chat模型）或max-tokens（embedding模型）
    - **dimensions**: 嵌入维度（仅embedding模型）
    """
    # 获取当前provider的favoriteModels配置
    provider_config = settings.get_config("provider", request.provider, default={})
    favorite_models = provider_config.get("favoriteModels")
    
    # 根据模型类型添加模型
    if request.modelType == "chat":
        # chat模型存储上下文长度
        favorite_models["chat"][request.modelId] = request.context
    elif request.modelType == "embedding":
        # embedding模型存储维度和max-tokens信息
        favorite_models["embedding"][request.modelId] = {
            "dimensions": request.dimensions,
            "max-tokens": request.context,
            "per-max-tokens": False
        }
    elif request.modelType == "other":
        # other模型只存储模型ID
        favorite_models["other"][request.modelId] = {}
    
    # 更新配置
    settings.update_config(favorite_models, "provider", request.provider, "favoriteModels")
    return settings.get_config("provider", default={})
    

@router.post("/favorite-models/remove", summary="删除常用模型", response_model=Dict[str, Dict])
async def remove_favorite_model(request: RemoveFavoriteModelRequest):
    """
    从指定提供商的favoriteModels中删除模型
    
    - **modelId**: 模型ID
    - **provider**: 提供商ID
    - **modelType**: 模型类型（chat/embedding/other）
    """
    # 获取提供商的favoriteModels配置
    model_dict = settings.get_config("provider", request.provider, "favoriteModels", request.modelType, default={})
    
    # 如果模型存在，删除它
    if request.modelId in model_dict:
        del model_dict[request.modelId]
        settings.update_config(model_dict, "provider", request.provider, "favoriteModels", request.modelType)
    return settings.get_config("provider", default={})

@router.post("/custom-providers", summary="添加自定义提供商", response_model=Dict[str, Any])
async def add_custom_provider(request: AddProviderRequest):
    """
    添加自定义提供商，自动生成唯一的英文ID作为provider_id，name仅用于显示
    
    - **name**: 提供商显示名称
    """
    provider_config = settings.get_config("provider", default={})
    
    # 检查显示名称是否已存在
    for config in provider_config.values():
        if config.get("name") == request.name:
            return {"error": "提供商名称已被使用"}
    
    # 生成唯一的英文ID（8位UUID）
    provider_id = str(uuid.uuid4())[:8]
    # 生成环境变量键名（大写的provider_id）
    env_key = f"{provider_id.upper()}_API_KEY"
    
    # 添加新的提供商配置
    settings.update_config({
        "name": request.name,
        "builtin": False,
        "enable": False,
        "url": "",
        "env_key": env_key,
        "favoriteModels": {
            "chat": {},
            "embedding": {},
            "other": {}
        },
    }, "provider", provider_id)
    
    return {
        "id": provider_id,
        "providers": settings.get_config("provider", default={})
    }

@router.put("/custom-providers/{provider_id}", summary="更新自定义提供商", response_model=Dict[str, Dict])
async def update_custom_provider(provider_id: str, request: UpdateProviderRequest):
    """
    更新自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    - **name**: 提供商名称（可选）
    - **enable**: 是否启用（可选）
    - **url**: API基础URL（可选）
    - **key**: API密钥（可选，保存到 .env 文件）
    - **favoriteModels**: 常用模型列表（可选）
    """
    provider_config, env_key = _get_provider_config(provider_id)
    
    updated_config = {}
    
    # 更新name
    if request.name is not None:
        updated_config["name"] = request.name
    elif "name" in provider_config:
        updated_config["name"] = provider_config["name"]

    # 更新enable
    if request.enable is not None:
        updated_config["enable"] = request.enable
    elif "enable" in provider_config:
        updated_config["enable"] = provider_config["enable"]
    
    # 更新URL
    if request.url is not None:
        updated_config["url"] = request.url
    elif "url" in provider_config:
        updated_config["url"] = provider_config["url"]
    
    # 更新favoriteModels
    if request.favoriteModels is not None:
        updated_config["favoriteModels"] = request.favoriteModels
    elif "favoriteModels" in provider_config:
        updated_config["favoriteModels"] = provider_config["favoriteModels"]
    
    # 保留builtin字段
    if "builtin" in provider_config:
        updated_config["builtin"] = provider_config["builtin"]
    
    # 保留env_key字段
    if "env_key" in provider_config:
        updated_config["env_key"] = provider_config["env_key"]
    
    # 更新 key 到 .env 文件（如果提供了）
    if request.key is not None:
        settings.set_api_key_to_env(env_key, request.key)
        
    # 更新提供商配置（保存到 store.yaml）
    settings.update_config(updated_config, "provider", provider_id)
    
    # 返回时从 .env 读取最新的 key
    return providers_list()

@router.delete("/custom-providers/{provider_id}", summary="删除自定义提供商", response_model=Dict[str, Dict])
async def delete_custom_provider(provider_id: str):
    """
    删除自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    """
    # 删除提供商
    settings.delete_config("provider", provider_id)
    
    return settings.get_config("provider", default={})


@router.get("/{provider_id}/api-key", summary="获取提供商API KEY信息", response_model=GetApiKeyResponse)
async def get_api_key_info(provider_id: str):
    """
    获取提供商的 API KEY 信息
    返回是否已设置 KEY，以及 KEY 的提示信息（不包含完整 KEY）
    
    - **provider_id**: 提供商ID（路径参数）
    """
    provider_config, env_key = _get_provider_config(provider_id)
    
    api_key = settings.get_provider_key(provider_id) or ""
    
    # 生成 KEY 的提示信息（如 sk-...xxxx）
    key_hint = ""
    if api_key:
        if len(api_key) > 8:
            key_hint = api_key[:4] + "..." + api_key[-4:]
        else:
            key_hint = "已设置"
    
    return GetApiKeyResponse(
        provider=provider_id,
        hasKey=bool(api_key),
        keyHint=key_hint
    )

@router.post("/{provider_id}/api-key", summary="设置提供商API KEY")
async def set_api_key(provider_id: str, request: SetApiKeyRequest):
    """
    设置提供商的 API KEY 到 .env 文件
    
    - **provider_id**: 提供商ID（路径参数）
    - **key**: API密钥（请求体）
    """
    provider_config, env_key = _get_provider_config(provider_id)
    
    success = settings.set_api_key_to_env(env_key, request.key)
    
    if not success:
        raise HTTPException(status_code=500, detail="保存API KEY失败")
    
    return {
        "success": True,
        "provider": provider_id,
        "message": "API KEY 已保存到 .env 文件"
    }

@router.delete("/{provider_id}/api-key", summary="删除提供商API KEY")
async def delete_api_key(provider_id: str):
    """
    从 .env 文件删除提供商的 API KEY
    
    - **provider_id**: 提供商ID（路径参数）
    """
    provider_config, env_key = _get_provider_config(provider_id)
    
    success = settings.remove_api_key_from_env(env_key)
    
    if not success:
        raise HTTPException(status_code=500, detail="删除API KEY失败")
    
    return {
        "success": True,
        "provider": provider_id,
        "message": "API KEY 已从 .env 文件删除"
    }
