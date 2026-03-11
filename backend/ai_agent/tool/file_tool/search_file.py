from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.config.config import settings
from backend.file.file_service import search_files_for_ai

class SearchFilesInput(BaseModel):
    path: Optional[str] = Field(default=None, description="搜索路径，不填则搜索根目录")
    regex: str = Field(description="正则表达式")

@tool(args_schema=SearchFilesInput)
async def search_file(path: Optional[str] = None, regex: str = None) -> str:
    """在指定文件或目录下搜索内容
    使用场景示例：
    1. 搜索单个文件
    {
        "path": "第一章.md",
        "regex": "张三"
    }
    2. 搜索包含多个关键词的内容
    {
        "path": "新建文件夹",
        "regex": "(张三|李四|王五)"
    }
    3. 在根目录搜索所有文件
    {
        "regex": "王五"
    }
    
    重要说明：
    1. path可以是文件路径或目录路径，不填则搜索根目录
    2. regex参数为正则表达式，语法参考Python re模块

    Args:
        path: 路径
        regex: 正则表达式
    """
    try:
        display_path = path if path else "根目录"
        
        # 使用 search_files_for_ai 进行搜索（已内置 .aiignore 过滤）
        results = await search_files_for_ai(regex)
        
        if results:
            return f"【工具结果】：在 '{display_path}' 中找到匹配项：\n\n{results}"
        else:
            return f"【工具结果】：在 '{display_path}' 中没有找到匹配项"
            
    except Exception as e:
        return f"【工具结果】：搜索失败: {str(e)}"
