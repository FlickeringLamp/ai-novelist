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

def create_db(documents, embeddings, collection_name):
    """
    创建向量数据库
    
    Args:
        documents: 文档列表
        embeddings: 嵌入模型实例
        collection_name: 集合名
    
    Returns:
        collection_name: 集合名
    """
    db_path = settings.CHROMADB_PERSIST_DIR
    
    # 创建数据库
    vector_store = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=db_path
    )
    
    # 生成文档ID并添加文档
    from uuid import uuid4
    uuids = [str(uuid4()) for _ in range(len(documents))]
    vector_store.add_documents(documents=documents, ids=uuids)
    
    print(f"向量数据库已创建并保存到: {db_path}, 集合: {collection_name}")
    return collection_name




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
    try:
        # 直接连接到已存在的数据库
        vector_store = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=db_path
        )
        
        print(f"成功加载数据库: {db_path}, 集合: {collection_name}")
        return vector_store
        
    except Exception as e:
        print(f"加载数据库失败: {e}")
        return None

def delete_collection(collection_name):
    """
    删除指定的数据库集合
    
    Args:
        collection_name: 要删除的集合
    
    Returns:
        bool: 删除是否成功
    """
    db_path = settings.CHROMADB_PERSIST_DIR
    try:
        # 使用 Chroma 的 PersistentClient 来删除集合
        import chromadb
        client = chromadb.PersistentClient(path=db_path)
        client.delete_collection(name=collection_name)
        
        print(f"成功删除数据库集合: {collection_name}")
        return True
    except Exception as e:
        print(f"删除数据库集合失败: {e}")
        return False


def add_file_to_collection(file_path, collection_name):
    """
    将新文件嵌入到已有的集合中
    
    Args:
        file_path: 文件路径
        collection_name: 集合名（知识库ID，如 db_xxx）
    
    Returns:
        bool: 添加是否成功
    """
    try:
        # 从配置获取知识库参数
        kb_config = settings.get_config('knowledgeBase', collection_name)
        if kb_config is None:
            print(f"未找到知识库配置: {collection_name}")
            return False
        
        chunk_size = kb_config.get('chunkSize', 1000)
        chunk_overlap = kb_config.get('overlapSize', 100)
        provider = kb_config.get('provider', '')
        model = kb_config.get('model', '')
        
        # 获取provider配置
        provider_config = settings.get_config('provider', provider)
        if provider_config is None:
            print(f"未找到提供商配置: {provider}")
            return False
        
        # 准备嵌入模型
        embeddings = prepare_emb(
            provider=provider,
            model_id=model,
            embedding_url=provider_config.get('url', ''),
            embedding_api_key=provider_config.get('key', '')
        )
        
        # 准备文档
        documents = prepare_doc(file_path, chunk_size, chunk_overlap)
        
        # 加载已有集合
        vector_store = load(embeddings, collection_name)
        if vector_store is None:
            print(f"加载集合失败: {collection_name}")
            return False
        
        # 生成文档ID并添加文档
        from uuid import uuid4
        uuids = [str(uuid4()) for _ in range(len(documents))]
        vector_store.add_documents(documents=documents, ids=uuids)
        
        print(f"成功将文件 {os.path.basename(file_path)} 添加到集合 {collection_name}")
        return True
    except Exception as e:
        print(f"添加文件到集合失败: {e}")
        return False


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
    try:
        import chromadb
        # 创建持久化客户端（不需要嵌入模型）
        client = chromadb.PersistentClient(path=db_path)
        
        # 获取集合
        collection = client.get_collection(name=collection_name)
        
        # 通过元数据过滤删除
        collection.delete(where={"original_filename": filename})
        
        print(f"成功从集合 {collection_name} 中移除文件 {filename}")
        return True
    except Exception as e:
        print(f"从集合中移除文件失败: {e}")
        return False


def get_files_in_collection(collection_name):
    """
    获取集合中包含的所有文件名
    
    Args:
        collection_name: 集合名
    
    Returns:
        list: 文件名列表
    """
    db_path = settings.CHROMADB_PERSIST_DIR
    try:
        import chromadb
        client = chromadb.PersistentClient(path=db_path)
        collection = client.get_collection(name=collection_name)
        
        # 获取所有文档的元数据
        results = collection.get(include=["metadatas"])
        
        # 提取 original_filename 并去重
        filenames = set()
        for metadata in results.get('metadatas', []):
            if metadata and 'original_filename' in metadata:
                filenames.add(metadata['original_filename'])
        
        return list(filenames)
    except Exception as e:
        print(f"获取集合文件列表失败: {e}")
        return []


def search_emb(vector_store,embeddings,search_input):
    results = vector_store.similarity_search_by_vector(
        embedding=embeddings.embed_query(search_input), 
        k=1
    )
    for doc in results:
        print("检索结果：")
        print(f"* {doc.page_content} [{doc.metadata}]")
