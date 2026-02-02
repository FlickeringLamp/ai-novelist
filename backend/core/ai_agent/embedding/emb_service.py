from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
import os
import shutil
from datetime import datetime
from pathlib import Path
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_ollama import OllamaEmbeddings
from backend.config import settings
from typing import Callable, Optional
import chromadb
from uuid import uuid4
import asyncio


def prepare_doc(orgfile_path, chunk_size, chunk_overlap):
    # 初始化documents列表
    documents = []
    loader = TextLoader(orgfile_path, encoding='utf-8')
    documents += loader.load()
    
    # 获取原始文件名
    original_filename = os.path.basename(orgfile_path)
    
    # 使用配置的分块参数进行文档切分
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]  # 优先按段落、句子、单词分割
    )
    documents = text_splitter.split_documents(documents)
    
    # 为每个文档片段添加元数据
    for i, doc in enumerate(documents):
        doc.metadata = {}
        # 添加自定义元数据
        doc.metadata.update({'original_filename': original_filename})
    
    print(f"文档切分完成: 分块长度={chunk_size}, 重叠长度={chunk_overlap}, 切分后文档数量={len(documents)}")
    return documents

def prepare_emb(provider, model_id,embedding_url,embedding_api_key=None):
    if provider == "aliyun":
        embeddings = DashScopeEmbeddings(
            model=model_id,
            dashscope_api_key=embedding_api_key
        )
        print(f"aliyun嵌入模型准备就绪")
        return embeddings

    elif provider == "ollama":
        embeddings = OllamaEmbeddings(
            model=model_id
        )
        print("ollama嵌入模型准备就绪")
        return embeddings

    else:
        print(f"塞给openaiembeddings的模型名{model_id}")
        embeddings = OpenAIEmbeddings(
            model=model_id,
            # dimensions=None,
            openai_api_key=embedding_api_key,
            openai_api_base=embedding_url,
            timeout=600,
            check_embedding_ctx_length=False,  # 禁用上下文长度检查，避免token化问题————不禁用，则阿里云无法使用，openrouter无法使用。某些中转需要不禁用
        )
        print("openai兼容嵌入模型准备就绪")
        return embeddings



# 指定数据库保存路径
db_path = Path("backend/data/chromadb")
# 确保目录存在,创建嵌入表
os.makedirs(db_path, exist_ok=True)


def load(embeddings, collection_name):
    """
    加载已存在的向量数据库
    
    Args:
        embeddings: 嵌入模型实例
        collection_name: 集合名
    
    Returns:
        vector_store: 向量存储实例
    """
    db_path = settings.CHROMADB_PERSIST_DIR
    # 直接连接到已存在的数据库
    vector_store = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=db_path
    )
    
    print(f"成功加载数据库: {db_path}, 集合: {collection_name}")
    return vector_store

def delete_collection(collection_name):
    """
    删除指定的数据库集合
    
    Args:
        collection_name: 要删除的集合
    
    Returns:
        bool: 删除是否成功
    """
    db_path = settings.CHROMADB_PERSIST_DIR
    # 使用 Chroma 的 PersistentClient 来删除集合
    client = chromadb.PersistentClient(path=db_path)
    client.delete_collection(name=collection_name)
    
    print(f"成功删除数据库集合: {collection_name}")
    return True

def create_collection(collection_name):
    """
    创建新的数据库集合
    
    Args:
        collection_name: 集合名（知识库ID，如 db_xxx）
    
    Returns:
        vector_store: 向量存储实例
    """
    # 从配置获取知识库参数
    kb_config = settings.get_config('knowledgeBase', collection_name)
    provider = kb_config.get('provider', '')
    model = kb_config.get('model', '')
    
    provider_config = settings.get_config('provider', provider)
    
    # 准备嵌入模型
    embeddings = prepare_emb(
        provider=provider,
        model_id=model,
        embedding_url=provider_config.get('url', ''),
        embedding_api_key=provider_config.get('key', '')
    )
    
    db_path = settings.CHROMADB_PERSIST_DIR
    # 使用 Chroma 创建新的集合
    vector_store = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=db_path
    )
    
    print(f"成功创建数据库集合: {collection_name}")
    return vector_store


async def add_file_to_collection(file_path, collection_name, progress_callback: Optional[Callable] = None, batch_size: int = 10):
    """
    将新文件嵌入到已有的集合中
    
    Args:
        file_path: 文件路径
        collection_name: 集合名（知识库ID，如 db_xxx）
        progress_callback: 异步进度回调函数，参数为 (current, total, message)
        batch_size: 每批处理的文档数量
    
    Returns:
        bool: 添加是否成功
    """
    # 从配置获取知识库参数
    kb_config = settings.get_config('knowledgeBase', collection_name)
    chunk_size = kb_config.get('chunkSize', 1000)
    chunk_overlap = kb_config.get('overlapSize', 100)
    provider = kb_config.get('provider', '')
    model = kb_config.get('model', '')
    
    provider_config = settings.get_config('provider', provider)
    
    # 准备嵌入模型
    embeddings = prepare_emb(
        provider=provider,
        model_id=model,
        embedding_url=provider_config.get('url', ''),
        embedding_api_key=provider_config.get('key', '')
    )
    
    # 准备文档
    documents = prepare_doc(file_path, chunk_size, chunk_overlap)
    total_docs = len(documents)
    
    # 加载已有集合
    vector_store = load(embeddings, collection_name)
    if vector_store is None:
        print(f"加载集合失败: {collection_name}")
        return False
    
    # 分批添加文档以显示进度
    for i in range(0, total_docs, batch_size):
        batch = documents[i:i + batch_size]
        uuids = [str(uuid4()) for _ in range(len(batch))]
        vector_store.add_documents(documents=batch, ids=uuids)
        
        if progress_callback:
            await progress_callback(i + len(batch), total_docs, f"已嵌入 {i + len(batch)}/{total_docs} 个文档片段")
            # 让出事件循环控制权，确保 WebSocket 消息能够立即发送
            await asyncio.sleep(0)
    
    print(f"成功将文件 {os.path.basename(file_path)} 添加到集合 {collection_name}")
    return True


def remove_file_from_collection(collection_name, filename):
    """
    从集合中移除指定文件及其所有向量
    
    Args:
        collection_name: 集合名
        filename: 要移除的文件名
    
    Returns:
        bool: 移除是否成功
    """
    db_path = settings.CHROMADB_PERSIST_DIR
    # 创建持久化客户端（不需要嵌入模型）
    client = chromadb.PersistentClient(path=db_path)
    
    # 获取集合
    collection = client.get_collection(name=collection_name)
    
    # 通过元数据过滤删除
    collection.delete(where={"original_filename": filename})
    
    print(f"成功从集合 {collection_name} 中移除文件 {filename}")
    return True


def get_files_in_collection(collection_name):
    """
    获取集合中包含的所有文件名及其片段数量
    
    Args:
        collection_name: 集合名
    
    Returns:
        dict: 文件名到片段数量的映射 {filename: chunk_count}
    """
    db_path = settings.CHROMADB_PERSIST_DIR
    client = chromadb.PersistentClient(path=db_path)
    collection = client.get_collection(name=collection_name)
    
    # 获取所有文档的元数据
    results = collection.get(include=["metadatas"])
    
    # 统计每个文件名的出现次数（即片段数量）
    file_chunk_counts = {}
    for metadata in results.get('metadatas', []):
        if metadata and 'original_filename' in metadata:
            filename = metadata['original_filename']
            file_chunk_counts[filename] = file_chunk_counts.get(filename, 0) + 1
    
    return file_chunk_counts


def search_emb(vector_store,embeddings,search_input):
    results = vector_store.similarity_search_by_vector(
        embedding=embeddings.embed_query(search_input), 
        k=1
    )
    for doc in results:
        print("检索结果：")
        print(f"* {doc.page_content} [{doc.metadata}]")
