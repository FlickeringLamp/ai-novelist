import logging
import os
import random
import shutil
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from backend.config import settings
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from backend.core.ai_agent.embedding.emb_service import (
    get_files_in_collection,
    add_file_to_collection,
    remove_file_from_collection,
    delete_collection
)

logger = logging.getLogger(__name__)


# 请求模型
class AddKnowledgeBaseRequest(BaseModel):
    """添加知识库请求"""
    id: str = Field(..., description="知识库ID（db_随机数）")
    name: str = Field(..., description="知识库名称")
    provider: str = Field(..., description="模型提供商ID")
    model: str = Field(..., description="嵌入模型名")
    dimensions: int = Field(..., description="嵌入维度")
    chunkSize: int = Field(..., description="分段大小")
    overlapSize: int = Field(..., description="重叠大小")
    similarity: float = Field(..., description="相似度")
    returnDocs: int = Field(..., description="返回文档片段数")


class UpdateKnowledgeBaseRequest(BaseModel):
    """更新知识库请求"""
    name: str = Field(None, description="知识库名称")
    provider: str = Field(None, description="模型提供商ID")
    model: str = Field(None, description="嵌入模型名")
    chunkSize: int = Field(None, description="分段大小")
    overlapSize: int = Field(None, description="重叠大小")
    similarity: float = Field(None, description="相似度")
    returnDocs: int = Field(None, description="返回文档片段数")


# 创建API路由器
router = APIRouter(prefix="/api/knowledge", tags=["Knowledge"])


# API端点

@router.get("/bases", summary="获取所有知识库", response_model=Dict[str, Dict])
def get_knowledge_bases():
    """
    获取所有知识库列表
    
    Returns:
        Dict[str, Dict]: 所有知识库配置
    """
    knowledge_base = settings.get_config("knowledgeBase", default={})
    return knowledge_base


@router.post("/bases", summary="添加知识库", response_model=Dict[str, Dict])
async def add_knowledge_base(request: AddKnowledgeBaseRequest):
    """
    添加新的知识库
    
    - **id**: 知识库ID（由前端生成，格式为db_随机数）
    - **name**: 知识库名称
    - **provider**: 模型提供商ID
    - **model**: 嵌入模型名
    - **dimensions**: 嵌入维度
    - **chunkSize**: 分段大小
    - **overlapSize**: 重叠大小
    - **similarity**: 相似度
    - **returnDocs**: 返回文档片段数
    """
    # 使用前端提供的ID
    kb_id = request.id
    
    # 创建知识库配置
    kb_config = {
        "name": request.name,
        "provider": request.provider,
        "model": request.model,
        "dimensions": request.dimensions,
        "chunkSize": request.chunkSize,
        "overlapSize": request.overlapSize,
        "similarity": request.similarity,
        "returnDocs": request.returnDocs
    }
    
    # 获取当前知识库配置
    knowledge_base = settings.get_config("knowledgeBase", default={})
    
    # 添加新知识库
    knowledge_base[kb_id] = kb_config
    
    # 更新配置
    settings.update_config(knowledge_base, "knowledgeBase")
    
    logger.info(f"添加知识库: {kb_id} - {request.name}")
    
    return knowledge_base


@router.put("/bases/{kb_id}", summary="更新知识库", response_model=Dict[str, Dict])
async def update_knowledge_base(kb_id: str, request: UpdateKnowledgeBaseRequest):
    """
    更新指定知识库
    
    - **kb_id**: 知识库ID（路径参数）
    - **name**: 知识库名称（可选）
    - **provider**: 模型提供商ID（可选）
    - **model**: 嵌入模型名（可选）
    - **chunkSize**: 分段大小（可选）
    - **overlapSize**: 重叠大小（可选）
    - **similarity**: 相似度（可选）
    - **returnDocs**: 返回文档片段数（可选）
    """
    # 获取当前知识库配置
    knowledge_base = settings.get_config("knowledgeBase", default={})
    
    # 检查知识库是否存在
    if kb_id not in knowledge_base:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")
    
    # 获取当前知识库配置
    current_config = knowledge_base[kb_id]
    
    # 更新配置（只更新提供的字段）
    updated_config = current_config.copy()
    
    if request.name is not None:
        updated_config["name"] = request.name
    if request.provider is not None:
        updated_config["provider"] = request.provider
    if request.model is not None:
        updated_config["model"] = request.model
    if request.chunkSize is not None:
        updated_config["chunkSize"] = request.chunkSize
    if request.overlapSize is not None:
        updated_config["overlapSize"] = request.overlapSize
    if request.similarity is not None:
        updated_config["similarity"] = request.similarity
    if request.returnDocs is not None:
        updated_config["returnDocs"] = request.returnDocs
    
    # 更新知识库配置
    knowledge_base[kb_id] = updated_config
    
    # 保存配置
    settings.update_config(knowledge_base, "knowledgeBase")
    
    logger.info(f"更新知识库: {kb_id}")
    
    return knowledge_base


@router.delete("/bases/{kb_id}", summary="删除知识库", response_model=Dict[str, Dict])
async def delete_knowledge_base(kb_id: str):
    """
    删除指定知识库（同时删除向量集合）
    
    - **kb_id**: 知识库ID（路径参数）
    """
    # 获取当前知识库配置
    knowledge_base = settings.get_config("knowledgeBase", default={})
    
    # 检查知识库是否存在
    if kb_id not in knowledge_base:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")
    
    # 删除向量集合
    delete_collection(kb_id)
    
    # 删除知识库配置
    del knowledge_base[kb_id]
    
    # 保存配置
    settings.update_config(knowledge_base, "knowledgeBase")
    
    logger.info(f"删除知识库: {kb_id}")
    
    return knowledge_base


@router.get("/bases/{kb_id}/files", summary="获取知识库中的文件列表", response_model=List[str])
async def get_knowledge_base_files(kb_id: str):
    """
    获取指定知识库中的所有文件名
    
    - **kb_id**: 知识库ID（路径参数）
    
    Returns:
        List[str]: 文件名列表
    """
    # 检查知识库是否存在
    knowledge_base = settings.get_config("knowledgeBase", default={})
    if kb_id not in knowledge_base:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")
    
    # 获取文件列表
    files = get_files_in_collection(kb_id)
    
    logger.info(f"获取知识库 {kb_id} 的文件列表: {len(files)} 个文件")
    
    return files


@router.post("/bases/{kb_id}/files", summary="上传文件到知识库")
async def upload_file_to_knowledge_base(
    kb_id: str,
    file: UploadFile = File(..., description="要上传的文件")
):
    """
    上传文件到指定知识库，并进行嵌入处理
    
    - **kb_id**: 知识库ID（路径参数）
    - **file**: 要上传的文件
    
    Returns:
        Dict: 操作结果
    """
    # 检查知识库是否存在
    knowledge_base = settings.get_config("knowledgeBase", default={})
    if kb_id not in knowledge_base:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")
    
    # 创建临时目录保存上传的文件
    temp_dir = "backend/data/temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    
    # 保存上传的文件
    file_path = os.path.join(temp_dir, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 将文件添加到知识库集合
        success = add_file_to_collection(file_path, kb_id)
        
        if success:
            logger.info(f"成功上传文件 {file.filename} 到知识库 {kb_id}")
            return {
                "success": True,
                "message": f"文件 {file.filename} 上传成功",
                "filename": file.filename
            }
        else:
            raise HTTPException(status_code=500, detail="文件嵌入处理失败")
    except Exception as e:
        logger.error(f"上传文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传文件失败: {str(e)}")
    finally:
        # 删除临时文件
        if os.path.exists(file_path):
            os.remove(file_path)


@router.delete("/bases/{kb_id}/files/{filename}", summary="从知识库删除文件")
async def delete_file_from_knowledge_base(kb_id: str, filename: str):
    """
    从指定知识库中删除文件及其所有向量
    
    - **kb_id**: 知识库ID（路径参数）
    - **filename**: 要删除的文件名（路径参数）
    
    Returns:
        Dict: 操作结果
    """
    # 检查知识库是否存在
    knowledge_base = settings.get_config("knowledgeBase", default={})
    if kb_id not in knowledge_base:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")
    
    # 从集合中移除文件
    success = remove_file_from_collection(kb_id, filename)
    
    if success:
        logger.info(f"成功从知识库 {kb_id} 中删除文件 {filename}")
        return {
            "success": True,
            "message": f"文件 {filename} 删除成功"
        }
    else:
        raise HTTPException(status_code=500, detail="删除文件失败")
