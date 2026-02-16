from pydantic import BaseModel, Field
from typing import Optional
from langchain.tools import tool
from langgraph.types import interrupt
from backend.ai_agent.embedding.emb_service import asearch_emb, get_files_in_collection


class SearchEmbeddingInput(BaseModel):
    """嵌入搜索的输入参数"""
    collection_id: str = Field(description="Knowledge base collection ID (e.g., db_xxx)")
    query: str = Field(description="搜索查询文本")
    filename_filter: Optional[str] = Field(default=None, description="可选的文件名筛选条件")


@tool(args_schema=SearchEmbeddingInput)
async def search_embedding(collection_id: str, query: str, filename_filter: Optional[str] = None) -> str:
    """在向量数据库中搜索相似内容便于文本参考
    建议生成句子而非词语，便于向量匹配
    例如：
        "龙可是帝王之征啊"（√）
        "龙"，"皇帝"等词语（×）
    
    Args:
        collection_id: Knowledge base collection ID (e.g., db_xxx)
        query: 搜索查询文本
        filename_filter: 可选的文件名筛选条件
    """
    interrupt_data = {
        "tool_name": "search_embedding",
        "tool_display_name": "向量搜索",
        "description": f"向量搜索: {query} (集合: {collection_id}, 文件筛选: {filename_filter or '无'})",
        "parameters": {
            "collection_id": collection_id,
            "query": query,
            "filename_filter": filename_filter
        }
    }
    user_choice = interrupt(interrupt_data)
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action != "1":
        return f"【工具结果】：用户取消了向量搜索 ;**【用户信息】：{choice_data}**"
    
    try:
        # 使用 emb_service 提供的异步搜索函数
        results = await asearch_emb(
            collection_name=collection_id,
            search_input=query,
            filename_filter=filename_filter
        )
        
        if not results:
            return f"【工具结果】：在集合 '{collection_id}' 中没有找到与查询 '{query}' 相关的内容 ;**【用户信息】：{choice_data}**"
        
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
        
        return f"【工具结果】：在集合 '{collection_id}' 中找到 {len(results)} 个与查询 '{query}' 相关的结果：\n\n{results_text} ;**【用户信息】：{choice_data}**"
        
    except Exception as e:
        return f"【工具结果】：搜索过程中发生错误: {str(e)} ;**【用户信息】：{choice_data}**"


class ListKnowledgeBaseInput(BaseModel):
    """列出知识库的输入参数"""
    collection_id: str = Field(description="Knowledge base collection ID (e.g., db_xxx)")


@tool(args_schema=ListKnowledgeBaseInput)
async def list_base_files(collection_id: str) -> str:
    """列出指定知识库中的文件信息
    注意：知识库内的文件不可使用普通文件工具操作，只可使用该工具，和search_embedding工具
    
    Args:
        collection_id: Knowledge base collection ID (e.g., db_xxx)
    """
    interrupt_data = {
        "tool_name": "list_base_files",
        "tool_display_name": "列出知识库文件",
        "description": f"列出知识库 '{collection_id}' 中的所有文件",
        "parameters": {
            "collection_id": collection_id
        }
    }
    user_choice = interrupt(interrupt_data)
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action != "1":
        return f"【工具结果】：用户取消了列出知识库文件 ;**【用户信息】：{choice_data}**"
    
    try:
        # 使用 emb_service 提供的函数获取文件列表
        file_info = get_files_in_collection(collection_id)
        
        if not file_info:
            return f"【工具结果】：集合 '{collection_id}' 中没有文件 ;**【用户信息】：{choice_data}**"
        
        # 格式化结果
        formatted_files = []
        for filename, info in file_info.items():
            file_item = f"文件名: {filename}\n"
            file_item += f"  文档块数: {info['chunk_count']}\n"
            file_item += f"  分块大小: {info['chunk_size']}\n"
            file_item += f"  重叠大小: {info['chunk_overlap']}\n"
            formatted_files.append(file_item)
        
        files_text = "\n".join(formatted_files)
        
        return f"【工具结果】：集合 '{collection_id}' 中包含 {len(file_info)} 个文件：\n\n{files_text} ;**【用户信息】：{choice_data}**"
        
    except Exception as e:
        return f"【工具结果】：列出知识库文件时发生错误: {str(e)} ;**【用户信息】：{choice_data}**"
