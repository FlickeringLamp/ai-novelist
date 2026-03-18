from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.ai_agent.embedding.emb_service import get_files_in_collection


class RagListFilesInput(BaseModel):
    collection_id: str = Field(description="知识库ID (e.g., db_xxx)")


@tool(args_schema=RagListFilesInput)
async def rag_list_files(collection_id: str) -> str:
    """
获取指定知识库内的文件列表
    """
    try:
        # 使用 emb_service 提供的函数获取文件列表
        file_info = get_files_in_collection(collection_id)
        
        if not file_info:
            return f"【工具结果】：集合 '{collection_id}' 中没有文件"
        
        # 格式化结果
        formatted_files = []
        for filename, info in file_info.items():
            file_item = f"文件名: {filename}\n"
            file_item += f"  文档块数: {info['chunk_count']}\n"
            file_item += f"  分块大小: {info['chunk_size']}\n"
            file_item += f"  重叠大小: {info['chunk_overlap']}\n"
            formatted_files.append(file_item)
        
        files_text = "\n".join(formatted_files)
        
        return f"【工具结果】：集合 '{collection_id}' 中包含 {len(file_info)} 个文件：\n\n{files_text}"
        
    except Exception as e:
        return f"【工具结果】：列出知识库文件时发生错误: {str(e)}"
