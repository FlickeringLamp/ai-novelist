import os
from typing import List, Optional
from langchain_core.embeddings import Embeddings
from backend.config.config import get_model_dir
from llama_cpp import Llama

class LlamaCppEmbeddings(Embeddings):
    """
    基于 llama-cpp-python 的本地嵌入模型实现
    兼容 LangChain Embeddings 接口
    """
    
    def __init__(
        self,
        model_name: str,
        n_ctx: int = 32768,  # 使用模型完整的训练上下文长度
        n_threads: Optional[int] = None,
        n_batch: int = 512,
        verbose: bool = False,
        **kwargs
    ):
        """
        初始化 LlamaCpp 嵌入模型
        
        Args:
            model_name: 模型文件名（如 "Qwen3-Embedding-0.6B-Q8_0.gguf"），
                       会自动拼接模型目录路径
            n_ctx: 上下文长度
            n_threads: 使用的线程数，None 表示自动检测
            n_batch: 批处理大小
            verbose: 是否输出详细日志
        """
        
        # 自动拼接模型目录路径
        model_dir = get_model_dir()
        # 确保模型文件名有 .gguf 扩展名
        if not model_name.endswith('.gguf'):
            model_name = model_name + '.gguf'
        model_path = os.path.join(model_dir, model_name)
        
        self.model_path = model_path
        self.n_ctx = n_ctx
        self.n_threads = n_threads or os.cpu_count() or 4
        self.n_batch = n_batch
        self.verbose = verbose
        
        # 验证模型文件存在
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"模型文件不存在: {model_path}")
        
        # 初始化模型（embedding_only 模式）
        self.client = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_threads=self.n_threads,
            n_batch=n_batch,
            verbose=verbose,
            embedding=True,  # 启用嵌入模式
            **kwargs
        )
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """批量嵌入文档"""
        embeddings = []
        for text in texts:
            embedding = self.client.embed(text)
            embeddings.append(embedding)
        return embeddings
    
    def embed_query(self, text: str) -> List[float]:
        """嵌入单个查询文本"""
        return self.client.embed(text)
    