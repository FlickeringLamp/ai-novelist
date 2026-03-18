from pydantic import BaseModel, Field
from typing import Optional
from langchain.tools import tool
from backend.ai_agent.embedding.emb_service import asearch_emb


class RagSearchInput(BaseModel):
    collection_id: str = Field(description="知识库ID (e.g., db_xxx)")
    query: str = Field(description="搜索查询文本")
    filename_filter: Optional[str] = Field(default=None, description="可选的文件名筛选，用于缩减范围，提升精准度")


@tool(args_schema=RagSearchInput)
async def rag_search(collection_id: str, query: str, filename_filter: Optional[str] = None) -> str:
    """
在向量数据库中检索语义相近内容
建议生成句子而非词语，便于向量匹配
例如：
"龙可是帝王之征啊"（√）
"龙"，"皇帝"等词语（×）
    """
    try:
        # 使用 emb_service 提供的异步搜索函数
        results = await asearch_emb(
            collection_name=collection_id,
            search_input=query,
            filename_filter=filename_filter
        )
        
        if not results:
            return f"【工具结果】：在集合 '{collection_id}' 中没有找到与查询 '{query}' 相关的内容"
        
        # 格式化搜索结果
        formatted_results = []
        for i, (doc, score) in enumerate(results):
            metadata = doc.metadata
            original_filename = metadata.get('original_filename', '未知')
            
            result_item = f"结果 {i+1} (相似度: {score:.4f}):\n"
            result_item += f"来源文件: {original_filename}\n"
            result_item += f"内容: {doc.page_content}\n"
            formatted_results.append(result_item)
        
        results_text = "\n".join(formatted_results)
        
        return f"【工具结果】：在集合 '{collection_id}' 中找到 {len(results)} 个与查询 '{query}' 相关的结果：\n\n{results_text}"
        
    except Exception as e:
        return f"【工具结果】：搜索过程中发生错误: {str(e)}"
