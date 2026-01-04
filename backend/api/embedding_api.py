import os
import json
from typing import List, Dict, Any
from pathlib import Path
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File

from backend.core.ai_agent.embedding.emb_service import prepare_emb, load_config, list_available_tables, delete_table, update_table_metadata, prepare_doc, create_db
from backend.config import ai_settings
from backend.core.ai_agent.models.providers_list import BUILTIN_PROVIDERS

# 请求模型
class GetEmbeddingDimensionsRequest(BaseModel):
    """获取嵌入模型维度请求"""
    model_info: str = Field(..., description="模型信息，格式为'提供商:模型ID'")

class SaveRagChunkSettingsRequest(BaseModel):
    """保存RAG分块设置请求"""
    chunkSize: int = Field(..., description="分块大小")
    chunkOverlap: int = Field(..., description="分块重叠大小")

class RenameKnowledgeBaseFileRequest(BaseModel):
    """重命名知识库文件请求"""
    new_name: str = Field(..., description="新的文件名")

# 创建路由器
router = APIRouter(prefix="/api/embedding", tags=["embedding"])

@router.post("/dimensions", response_model=Dict[str, Any])
async def get_embedding_dimensions(request: GetEmbeddingDimensionsRequest):
    """
    获取指定嵌入模型的维度
    
    Args:
        request: 包含模型信息的请求体，格式为"模型提供商：模型id"
        
    Returns:
        嵌入维度响应
    """
    try:
        # 解析模型信息
        model_info = request.model_info
        print(f"从前端得到的模型信息为{model_info}")
        
        provider, provider_model_id = model_info.split(":", 1)
        provider = provider.strip()
        provider_model_id = provider_model_id.strip()
        
        # 处理provider_model_id：去掉第一个前缀（例如从"siliconflow/Qwen/Qwen3-Embedding-8B"变为"Qwen/Qwen3-Embedding-8B"）
        if "/" in provider_model_id:
            # 只去掉第一个前缀部分
            parts = provider_model_id.split("/", 1)
            model_id = parts[1]
            print(f"整理后的模型名{model_id}")
        # 检查是否为内置提供商
        if provider in BUILTIN_PROVIDERS:
            # 内置提供商直接使用默认URL
            embedding_url = BUILTIN_PROVIDERS[provider]
        else:
            # 自定义提供商从配置文件获取URL
            embedding_url = ai_settings.get_base_url_for_provider(provider)
            if not embedding_url:
                raise HTTPException(
                    status_code=400,
                    detail=f"未找到提供商 {provider} 的URL配置"
                )
        
        # 获取API key
        if provider == "ollama":
            api_key = ""
        else:
            api_key = ai_settings.get_api_key_for_provider(provider)
        
        print(f"提供商: {provider}, 模型ID: {model_id}")
        print(f"URL: {embedding_url}")
        print(f"API Key: {api_key[:10]}..." if api_key and len(api_key) > 10 else "API Key: None")
        
        # 尝试通过实际API调用获取维度
        try:
            # 准备嵌入模型
            embeddings = prepare_emb(provider, model_id, embedding_url, api_key)
            # 发送测试请求获取嵌入向量
            test_text = "test"
            print(f"发送测试请求，文本: '{test_text}'")
            embedding_vector = embeddings.embed_query(test_text)
            
            # 获取向量长度作为维度
            dimensions = len(embedding_vector)
            
            # 保存维度信息到store.json
            await save_embedding_dimensions_to_config(provider, model_id, dimensions)
            print(f"获取到维度{dimensions}")
            return {
                "dimensions": dimensions,
                "model_id": model_id
            }
            
        except Exception as api_error:
            # 如果API调用失败，返回0
            dimensions = 0
            print(f"API调用失败，错误详情: {str(api_error)}")
            print(f"错误类型: {type(api_error).__name__}")
            
            # 尝试获取更详细的错误信息
            if hasattr(api_error, 'response'):
                print(f"HTTP状态码: {api_error.response.status_code}")
                print(f"响应内容: {api_error.response.text}")
            
            # 保存默认维度信息到store.json
            await save_embedding_dimensions_to_config(provider, model_id, dimensions)
            
            return {
                "dimensions": dimensions,
                "model_id": model_id
            }
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取嵌入维度失败: {str(e)}"
        )

async def save_embedding_dimensions_to_config(provider: str, model_id: str, dimensions: int):
    """
    保存嵌入模型维度到配置文件
    
    Args:
        provider: 模型提供商
        model_id: 模型ID
        dimensions: 维度值
    """
    try:
        # 加载当前配置
        config = load_config()
        
        # 确保config是一个字典
        if not isinstance(config, dict):
            config = {}
        
        # 每次保存时先清空现有数据，只保留当前模型的信息
        config["embeddingModels"] = {
            "provider": provider,
            "modelId": model_id,
            "dimensions": dimensions
        }
        
        # 保存到文件
        config_file = Path(__file__).parent.parent /"data"/ "config" / "store.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
            
        print(f"已保存提供商 {provider} 的模型 {model_id} 的维度 {dimensions} 到配置文件")
        
    except Exception as e:
        print(f"保存嵌入维度到配置文件失败: {e}")



# 从已有配置里读取嵌入模型信息
def get_emb_model_key_url_dimensions():
    # 加载配置
    config = load_config()
    # 从embeddingModels获取modelId并解析provider和embedding_model
    embedding_model_config = config.get("embeddingModels", {})
    provider = embedding_model_config.get("provider","")
    model_id = embedding_model_config.get("modelId", "")
    dimensions = embedding_model_config.get("dimensions","")
    
    
    # 确定嵌入URL和api_key
    if provider in BUILTIN_PROVIDERS:
        embedding_url = BUILTIN_PROVIDERS[provider]
    else:
        embedding_url = ai_settings.get_base_url_for_provider(provider)
        if not embedding_url:
            raise HTTPException(
                status_code=400,
                detail=f"未找到提供商{provider}的URL配置"
            )
    
    if provider == "ollama":
        api_key = ""
    else:
        api_key = ai_settings.get_api_key_for_provider(provider)
    return provider, model_id, embedding_url, api_key, dimensions

# RAG分块设置相关API
@router.get("/rag/chunk-settings", response_model=Dict[str, Any])
async def get_rag_chunk_settings():
    """
    获取RAG分块设置
    
    Returns:
        RAG分块设置响应
    """
    try:
        # 加载配置
        config = load_config()
        
        # 获取分块设置
        chunk_size = config.get("ragChunkSize", 200)
        chunk_overlap = config.get("ragChunkOverlap", 50)
        
        return {
            "chunkSize": chunk_size,
            "chunkOverlap": chunk_overlap
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取RAG分块设置失败: {str(e)}"
        )

@router.post("/rag/chunk-settings", response_model=Dict[str, Any])
async def save_rag_chunk_settings(request: SaveRagChunkSettingsRequest):
    """
    保存RAG分块设置
    
    Args:
        request: 包含分块设置的请求体
        
    Returns:
        RAG分块设置响应
    """
    try:
        # 加载当前配置
        config = load_config()
        
        # 更新分块设置
        config["ragChunkSize"] = request.chunkSize
        config["ragChunkOverlap"] = request.chunkOverlap
        
        # 保存到文件
        config_file = Path(__file__).parent.parent /"data"/ "config" / "store.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
            
        print(f"已保存RAG分块设置: chunkSize={chunkSize}, chunkOverlap={chunkOverlap}")
        
        return {
            "chunkSize": chunkSize,
            "chunkOverlap": chunkOverlap
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"保存RAG分块设置失败: {str(e)}"
        )

# 知识库文件列表相关API
@router.get("/rag/files", response_model=List[Dict[str, Any]])
async def list_knowledge_base_files():
    """
    列出知识库中的所有文件
    
    Returns:
        知识库文件列表响应
    """
    try:        
        # 确定嵌入URL和api_key
        provider, embedding_model, embedding_url, api_key, dimensions = get_emb_model_key_url_dimensions()
        
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
        
        # 如果有嵌入模型，准备嵌入实例以获取详细信息
        embeddings = None
        if embedding_model:
            print(f"准备读取文件的嵌入模型：{embedding_model}")
            try:
                embeddings = prepare_emb(provider, embedding_model, embedding_url, api_key)
            except Exception as e:
                print(f"准备嵌入模型失败，将只显示基本表信息: {e}")
        
        # 获取可用表列表
        tables = list_available_tables(db_path, embeddings)
        
        # 转换为前端期望的格式
        files = []
        for table in tables:
            files.append({
                "id": table["table_name"],  # 使用表名作为ID
                "name": table["original_filename"],  # 显示原始文件名
                "table_name": table["table_name"],  # 表名
                "created_at": table.get("created_at", "未知"),  # 创建时间
                "total_chunks": table.get("total_chunks", 0),  # 片段数量
                "chunk_size": table.get("chunk_size",0), # 切分长度
                "chunk_overlap": table.get("chunk_overlap",0), # 重叠长度
                "dimensions": table.get("dimensions",0) # 嵌入维度
            })
        
        return files
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取知识库文件列表失败: {str(e)}"
        )

# 删除知识库文件相关API
@router.delete("/rag/files/{table_name}", response_model=Dict[str, Any])
async def delete_knowledge_base_file(table_name: str):
    """
    删除指定的知识库文件
    
    Args:
        table_name: 要删除的表名
        
    Returns:
        删除结果响应
    """
    try:
        # 数据库路径 - 与emb_service.py保持一致
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
        
        # 调用删除函数
        result = delete_table(db_path, table_name)
        
        if result:
            return {}
        else:
            return {}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除知识库文件失败: {str(e)}"
        )

# 重命名知识库文件相关API
@router.put("/rag/files/{table_name}/rename", response_model=Dict[str, Any])
async def rename_knowledge_base_file(table_name: str, request: RenameKnowledgeBaseFileRequest):
    """
    重命名指定的知识库文件（仅更新元数据中的original_filename）
    
    Args:
        table_name: 要重命名的表名
        request: 包含新文件名的请求体
        
    Returns:
        重命名结果响应
    """
    try:
        # 确定提供商，模型名，url，密钥，维度
        provider, embedding_model, embedding_url, api_key, dimensions = get_emb_model_key_url_dimensions()
        
        # 数据库路径 - 与emb_service.py保持一致
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
        
        # 准备嵌入模型实例
        embeddings = None
        if embedding_model:
            try:
                embeddings = prepare_emb(provider, embedding_model, embedding_url, api_key)
            except Exception as e:
                print(f"准备嵌入模型失败: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"准备嵌入模型失败: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="未配置嵌入模型，无法重命名文件"
            )
        
        # 调用更新元数据函数，只更新original_filename字段
        result = update_table_metadata(db_path, table_name, embeddings, {'original_filename': request.new_name})
        
        if result:
            return {}
        else:
            return {}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"重命名知识库文件失败: {str(e)}"
        )

# 添加文件到知识库相关API
@router.post("/rag/files", response_model=str)
async def add_file_to_knowledge_base(file: UploadFile = File(...)):
    """
    添加文件到知识库
    
    Args:
        file: 上传的文件
        
    Returns:
        添加结果响应
    """
    try:
        # 加载配置
        config = load_config()
        
        provider, embedding_model, embedding_url, api_key, dimensions = get_emb_model_key_url_dimensions()
        
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
        
        # 创建临时目录保存上传的文件
        temp_dir = os.path.join(os.path.dirname(__file__), "..", "data", "temp")
        os.makedirs(temp_dir, exist_ok=True)
        
        # 保存上传的文件到临时目录
        temp_file_path = os.path.join(temp_dir, file.filename)
        with open(temp_file_path, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        try:
            # 准备嵌入模型
            embeddings = prepare_emb(provider, embedding_model, embedding_url, api_key)
            
            # 获取RAG分块设置
            chunk_size = config.get("ragChunkSize", 200)
            chunk_overlap = config.get("ragChunkOverlap", 50)
            
            # 准备文档
            documents = prepare_doc(temp_file_path, chunk_size, chunk_overlap)
            
            # 创建数据库
            table_name = create_db(documents, embeddings, db_path)
            
            return table_name
            
        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"添加文件到知识库失败: {str(e)}"
        )