from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import LanceDB
import os
import shutil
from datetime import datetime
from pathlib import Path
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_ollama import OllamaEmbeddings
from backend.config import settings


def prepare_doc(orgfile_path,chunk_size,chunk_overlap):
    # 初始化documents列表
    documents = []
    loader = TextLoader(orgfile_path, encoding='utf-8')
    documents += loader.load()
    
    # 获取原始文件名
    original_filename = os.path.basename(orgfile_path)
    
    # 获取维度
    embedding_dimensions = settings.get_config("embeddingModels", "dimensions", default=0)
    
    # 使用配置的分块参数进行文档切分
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]  # 优先按段落、句子、单词分割
    )
    documents = text_splitter.split_documents(documents)
    
    # 为每个文档片段添加元数据
    for i, doc in enumerate(documents):
        # 保留原有元数据
        if not doc.metadata:
            doc.metadata = {}
        
        # 添加自定义元数据
        doc.metadata.update({
            'original_filename': original_filename,
            'file_path': orgfile_path,
            'chunk_index': i,
            'total_chunks': len(documents),
            'chunk_size': chunk_size,
            'chunk_overlap': chunk_overlap,
            'dimensions': embedding_dimensions,
            'created_at': datetime.now().isoformat()
        })
    
    print(f"文档切分完成: 分块长度={chunk_size}, 重叠长度={chunk_overlap}, 切分后文档数量={len(documents)},维度={embedding_dimensions}")
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
db_path = Path("backend/data/lancedb")
# 确保目录存在,创建嵌入表
os.makedirs(db_path, exist_ok=True)
def create_db(documents, embeddings, db_path):
    # 根据时间戳生成表名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    table_name = f"db_{timestamp}"
    
    # 创建数据库
    docemb = LanceDB.from_documents(
        documents,
        embeddings,
        uri=db_path,  # 固定的保存路径
        table_name=table_name  # 使用时间戳生成的表名
    )
    print(f"向量数据库已创建并保存到: {db_path}, 表名: {table_name}")
    return table_name




def load(embeddings, db_path, table_name):
    """
    加载已存在的向量数据库
    """
    # 获取数据库文件完整路径
    db_file = os.path.join(db_path, f"{table_name}.lance")
    
    # 检查数据库是否存在
    if not os.path.exists(db_file):
        print(f"数据库不存在: {db_file}")
        return None
    
    try:
        # 直接连接到已存在的数据库
        vector_store = LanceDB(
            embedding=embeddings,
            uri=db_path,
            table_name=table_name  # 使用传入的表名参数
        )
        
        print(f"成功加载数据库: {db_path}, 表名: {table_name}")
        return vector_store
        
    except Exception as e:
        print(f"加载数据库失败: {e}")
        return None


def list_available_tables(db_path, embeddings=None):
    """
    列出数据库路径中所有可用的表，并显示对应的原始文件名
    
    Args:
        db_path: 数据库路径
        embeddings: 嵌入模型实例（可选，用于获取表详细信息）
    
    Returns:
        list: 包含表名和文件名的字典列表
    """
    if not os.path.exists(db_path):
        print(f"数据库路径不存在: {db_path}")
        return []
    
    # 获取所有 .lance 文件
    lance_files = [f for f in os.listdir(db_path) if f.endswith('.lance')]
    
    # 提取表名（去掉 .lance 后缀）
    table_names = [f.replace('.lance', '') for f in lance_files]
    
    result = []
    print("当前可用的知识库表：")
    
    for table_name in table_names:
        table_info = {"table_name": table_name, "original_filename": "未知"}
        
        # 如果提供了embeddings，尝试获取表的详细信息
        if embeddings:
            try:
                # 连接到表
                vector_store = LanceDB(
                    embedding=embeddings,
                    uri=db_path,
                    table_name=table_name
                )
                
                # 获取第一条记录来提取元数据
                # 使用limit(1)只获取一条记录以提高性能
                results = vector_store.similarity_search_with_score(
                    query="test",
                    k=1
                )
                
                if results:
                    doc, score = results[0]
                    original_filename = doc.metadata.get('original_filename', '未知')
                    created_at = doc.metadata.get('created_at', '未知')
                    total_chunks = doc.metadata.get('total_chunks', '未知')
                    chunk_size = doc.metadata.get('chunk_size', 0)
                    chunk_overlap = doc.metadata.get('chunk_overlap', 0)
                    dimensions = doc.metadata.get('dimensions', 0)
                    
                    table_info.update({
                        "original_filename": original_filename,
                        "created_at": created_at,
                        "total_chunks": total_chunks,
                        "chunk_size": chunk_size,
                        "chunk_overlap": chunk_overlap,
                        "dimensions": dimensions
                    })
                    
                    print(f"- 表名: {table_name} | 文件名: {original_filename} | 创建时间: {created_at} | 片段数: {total_chunks} | 切分长度: {chunk_size} | 重叠长度: {chunk_overlap}")
                else:
                    print(f"- 表名: {table_name} | 文件名: 未知 | 状态: 空表")
                    
            except Exception as e:
                print(f"- 表名: {table_name} | 文件名: 未知 | 状态: 无法访问 ({str(e)})")
        else:
            # 如果没有提供embeddings，只显示表名
            print(f"- 表名: {table_name} | 文件名: 需要提供embeddings参数获取详细信息")
        
        result.append(table_info)
    
    return result
def delete_table(db_path, table_name):
    """
    删除指定的数据库表文件
    
    Args:
        db_path: 数据库路径
        table_name: 要删除的表名
    
    Returns:
        bool: 删除是否成功
    """
    # 构建数据库文件路径
    db_dir = os.path.join(db_path, f"{table_name}.lance")
    
    # 检查数据库目录是否存在
    if not os.path.exists(db_dir):
        print(f"数据库表不存在: {db_dir}")
        return False
    
    try:
        # shutil.rmtree递归删除
        shutil.rmtree(db_dir)
        
        print(f"成功删除数据库表: {table_name}")
        return True
    except Exception as e:
        print(f"删除数据库表失败: {e}")
        return False

def update_table_metadata(db_path, table_name, embeddings, metadata_updates):
    """
    更新表中所有文档的元数据（使用LanceDB的原生API）
    
    Args:
        db_path: 数据库路径
        table_name: 表名
        embeddings: 嵌入模型实例
        metadata_updates: 要更新的元数据字典，如 {'original_filename': '新文件名.txt'}
    
    Returns:
        bool: 更新是否成功
    """
    try:
        # 直接连接到LanceDB
        import lancedb
        db = lancedb.connect(db_path)
        table = db.open_table(table_name)
        
        # 获取所有数据
        arrow_data = table.to_arrow()
        data = arrow_data.to_pylist()
        
        # 更新所有行的元数据
        for i in range(len(data)):
            updated_metadata = data[i]['metadata'].copy()
            updated_metadata.update(metadata_updates)
            data[i]['metadata'] = updated_metadata
        
        # 删除表中的所有数据
        table.delete(where="1=1")
        
        # 添加更新后的数据
        table.add(data)
        
        print(f"成功更新表 {table_name} 的元数据，更新了 {len(data)} 行")
        return True
        
    except Exception as e:
        print(f"更新表元数据失败: {e}")
        return False

def search_emb(vector_store,embeddings,search_input):
    results = vector_store.similarity_search_by_vector(
        embedding=embeddings.embed_query(search_input), 
        k=1
    )
    for doc in results:
        print("检索结果：")
        print(f"* {doc.page_content} [{doc.metadata}]")
