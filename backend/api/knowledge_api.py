import logging
import os
import shutil
from typing import Dict, List
from pydantic import BaseModel, Field
from backend.settings.settings import settings
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from backend.ai_agent.embedding import (
    get_files_in_collection,
    add_file_to_collection,
    remove_file_from_collection,
    delete_collection,
    create_collection,
    search_emb,
    asearch_emb,
    get_all_knowledge_bases,
    get_two_step_rag_config,
    set_two_step_rag_config
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


class SearchKnowledgeBaseRequest(BaseModel):
    """搜索知识库请求"""
    query: str = Field(..., description="搜索查询文本")
    filename_filter: str = Field(None, description="可选的文件名筛选条件")


class SetTwoStepRagRequest(BaseModel):
    """设置两步RAG请求"""
    id: str | None = Field(None, description="知识库ID，传入null则清除配置")
    name: str | None = Field(None, description="知识库名称，传入null则清除配置")


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
    return get_all_knowledge_bases()


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
    
    # 获取提供商配置（用于创建集合）
    provider_config = settings.get_config('provider', request.provider)
    api_key = settings.get_provider_key(request.provider)
    
    # 先创建ChromaDB集合，失败则直接报错不写入配置
    create_collection(
        collection_name=kb_id,
        provider=request.provider,
        model=request.model,
        provider_url=provider_config.get('url', ''),
        api_key=api_key
    )
    
    # 创建成功后，写入配置
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
    
    # 获取当前知识库配置并添加新的
    knowledge_base = settings.get_config("knowledgeBase", default={})
    knowledge_base[kb_id] = kb_config
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
    knowledge_base = settings.get_config("knowledgeBase", default={})
    
    if kb_id not in knowledge_base:
        raise ValueError(f"知识库 {kb_id} 不存在")
    
    current_config = knowledge_base[kb_id]
    updated_config = current_config.copy()
    
    for key, value in request.model_dump(exclude_none=True).items():
        updated_config[key] = value
    
    knowledge_base[kb_id] = updated_config
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
    
    # 先删除知识库配置（即使集合删除失败，配置也能清理干净）
    del knowledge_base[kb_id]
    settings.update_config(knowledge_base, "knowledgeBase")
    
    # 再删除向量集合（忽略不存在的错误）
    try:
        delete_collection(kb_id)
    except Exception:
        pass  # 集合可能不存在，忽略错误
    
    logger.info(f"删除知识库: {kb_id}")
    return knowledge_base


@router.get("/bases/{kb_id}/files", summary="获取知识库中的文件列表", response_model=Dict[str, Dict[str, int]])
async def get_knowledge_base_files(kb_id: str):
    """
    获取指定知识库中的所有文件名及其片段数量和切分参数
    
    - **kb_id**: 知识库ID（路径参数）
    
    Returns:
        Dict[str, Dict[str, int]]: 文件名到文件信息的映射 {filename: {"chunk_count": count, "chunk_size": size, "chunk_overlap": overlap}}
    """
    
    # 获取文件列表及片段数量
    files = get_files_in_collection(kb_id)
    
    logger.info(f"获取知识库 {kb_id} 的文件列表: {len(files)} 个文件")
    
    return files


@router.post("/bases/{kb_id}/files", summary="上传文件到知识库")
async def upload_file_to_knowledge_base(
    kb_id: str,
    file: UploadFile = File(..., description="要上传的文件"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    上传文件到指定知识库，并进行嵌入处理（异步）
    
    - **kb_id**: 知识库ID（路径参数）
    - **file**: 要上传的文件
    
    Returns:
        Dict: 操作结果
    """
    
    # 使用配置的临时目录保存上传的文件
    temp_dir = settings.TEMP_DIR
    
    # 保存上传的文件
    file_path = os.path.join(temp_dir, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 添加后台任务处理嵌入
        background_tasks.add_task(add_file_to_collection, file_path, kb_id)
        
        logger.info(f"开始异步上传文件 {file.filename} 到知识库 {kb_id}")
        return {
            "success": True,
            "message": f"文件 {file.filename} 开始上传，请通过WebSocket查看进度",
            "filename": file.filename
        }
    except Exception as e:
        logger.error(f"上传文件失败: {e}")


@router.delete("/bases/{kb_id}/files/{filename}", summary="从知识库删除文件")
async def delete_file_from_knowledge_base(kb_id: str, filename: str):
    """
    从指定知识库中删除文件及其所有向量
    
    - **kb_id**: 知识库ID（路径参数）
    - **filename**: 要删除的文件名（路径参数）
    
    Returns:
        Dict: 操作结果
    """
    
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


@router.post("/bases/{kb_id}/search", summary="搜索知识库")
def search_knowledge_base(kb_id: str, request: SearchKnowledgeBaseRequest):
    """
    在指定知识库中搜索相关文档（同步版本）
    
    - **kb_id**: 知识库ID（路径参数）
    - **query**: 搜索查询文本
    - **filename_filter**: 可选的文件名筛选条件
    
    Returns:
        List[Dict]: 搜索结果列表，每个结果包含文档内容和元数据
    """
    # 使用同步搜索函数
    results = search_emb(
        collection_name=kb_id,
        search_input=request.query,
        filename_filter=request.filename_filter
    )
    
    # 格式化返回结果
    formatted_results = []
    for doc, score in results:
        formatted_results.append({
            "content": doc.page_content,
            "metadata": doc.metadata,
            "score": score
        })
    
    logger.info(f"在知识库 {kb_id} 中搜索到 {len(formatted_results)} 条结果")
    
    return {
        "success": True,
        "results": formatted_results,
        "total": len(formatted_results)
    }


@router.post("/bases/{kb_id}/asearch", summary="搜索知识库（异步）")
async def search_knowledge_base_async(kb_id: str, request: SearchKnowledgeBaseRequest):
    """
    在指定知识库中搜索相关文档（异步版本）
    
    - **kb_id**: 知识库ID（路径参数）
    - **query**: 搜索查询文本
    - **filename_filter**: 可选的文件名筛选条件
    
    Returns:
        List[Dict]: 搜索结果列表，每个结果包含文档内容和元数据
    """
    # 使用异步搜索函数
    results = await asearch_emb(
        collection_name=kb_id,
        search_input=request.query,
        filename_filter=request.filename_filter
    )
    
    # 格式化返回结果
    formatted_results = []
    for doc, score in results:
        formatted_results.append({
            "content": doc.page_content,
            "metadata": doc.metadata,
            "score": score
        })
    
    logger.info(f"在知识库 {kb_id} 中搜索到 {len(formatted_results)} 条结果")
    
    return {
        "success": True,
        "results": formatted_results,
        "total": len(formatted_results)
    }


@router.get("/two-step-rag", summary="获取两步RAG配置")
def get_two_step_rag():
    """
    获取两步RAG的配置
    
    Returns:
        Dict: 包含id和name的字典，如果没有配置则返回{"id": None, "name": None}
    """
    return get_two_step_rag_config()


@router.put("/two-step-rag", summary="设置两步RAG配置")
def set_two_step_rag(request: SetTwoStepRagRequest):
    """
    设置或切换两步RAG配置
    
    - **id**: 知识库ID，传入null则清除配置
    - **name**: 知识库名称，传入null则清除配置
    
    Returns:
        Dict: 包含id和name的字典
    """
    result = set_two_step_rag_config(request.id, request.name)
    logger.info(f"设置两步RAG配置: {result}")
    return result
