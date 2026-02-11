import logging
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from backend.config.config import settings
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

# 创建API路由器
router = APIRouter(prefix="/api/provider", tags=["Provider"])

# API端点

# 所有提供商列表
@router.get("/providers", summary="获取提供商列表", response_model=Dict[str, Dict])
def providers_list():
    """获取所有提供商列表（包含完整信息）"""
    provider_config = settings.get_config("provider", default={})
    return provider_config



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
        # 获取provider的API配置
        api_key = settings.get_config("provider", provider_id, "key", default="")
        base_url = settings.get_config("provider", provider_id, "url", default="")
        
        # 调用get_available_models方法获取在线模型列表
        models = MultiModelAdapter.get_available_models(provider_id, api_key, base_url)
        
        # 将模型列表转换为字典格式返回
        return models
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

@router.post("/custom-providers", summary="添加自定义提供商", response_model=Dict[str, Dict])
async def add_custom_provider(request: AddProviderRequest):
    """
    添加自定义提供商，默认第一次name设置为id，后续可以更改用于显示的name，id保持不变
    
    - **name**: 提供商名称
    """
    provider_config = settings.get_config("provider", default={})
    # 检查名称是否已存在
    if request.name in provider_config:
        return {"error": "名称已被使用"}
    # 添加新的提供商
    settings.update_config({
        "name": request.name,
        "builtin": False,
        "enable": False,
        "url": "",
        "key": "",
        "favoriteModels": {
            "chat": {},
            "embedding": {},
            "other": {}
        },
    }, "provider", request.name)
    
    return settings.get_config("provider", default={})

@router.put("/custom-providers/{provider_id}", summary="更新自定义提供商", response_model=Dict[str, Dict])
async def update_custom_provider(provider_id: str, request: UpdateProviderRequest):
    """
    更新自定义提供商
    
    - **provider_id**: 提供商ID（路径参数）
    - **name**: 提供商名称（可选）
    - **enable**: 是否启用（可选）
    - **url**: API基础URL（可选）
    - **key**: API密钥（可选）
    - **favoriteModels**: 常用模型列表（可选）
    """
    provider_config = settings.get_config("provider", default={})
    # 获取当前提供商的配置
    current_config = provider_config[provider_id]
    
    updated_config = {}
    
    # 更新name
    if request.name is not None:
        updated_config["name"] = request.name
    elif "name" in current_config:
        updated_config["name"] = current_config["name"]

    # 更新enable
    if request.enable is not None:
        updated_config["enable"] = request.enable
    elif "enable" in current_config:
        updated_config["enable"] = current_config["enable"]
    
    # 更新URL
    if request.url is not None:
        updated_config["url"] = request.url
    elif "url" in current_config:
        updated_config["url"] = current_config["url"]
    
    # 更新Key
    if request.key is not None:
        updated_config["key"] = request.key
    elif "key" in current_config:
        updated_config["key"] = current_config["key"]
    
    # 更新favoriteModels
    if request.favoriteModels is not None:
        updated_config["favoriteModels"] = request.favoriteModels
    elif "favoriteModels" in current_config:
        updated_config["favoriteModels"] = current_config["favoriteModels"]
    
    # 保留builtin字段
    if "builtin" in current_config:
        updated_config["builtin"] = current_config["builtin"]
        
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

