import re
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.config.config import settings
from backend.file.file_service import read_file as file_service_read_file
from backend.ai_agent.utils.file_utils import split_paragraphs

class SearchFilesInput(BaseModel):
    """搜索文件的输入参数"""
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
        # 将相对路径拼接NOVEL_DIR，如果不填path则使用根目录
        if path is None or path == "":
            search_path = Path(settings.NOVEL_DIR)
            display_path = "根目录"
        else:
            search_path = Path(settings.NOVEL_DIR) / path
            display_path = path
        
        pattern = re.compile(regex)
        results = []
        
        if search_path.is_file():
            # 搜索单个文件
            try:
                content = await file_service_read_file(path)
                
                # 使用统一的段落分割函数
                paragraphs, _ = split_paragraphs(content)
                for paragraph_num, paragraph in enumerate(paragraphs, 1):
                    if pattern.search(paragraph):
                        results.append({
                            "file": str(search_path),
                            "paragraph": paragraph_num,
                            "content": paragraph.strip()
                        })
            except Exception as e:
                return f"【工具结果】：读取文件失败: {str(e)}"
                
        elif search_path.is_dir():
            # 递归搜索目录中的所有文件
            for file_path in search_path.rglob("*"):
                if file_path.is_file():
                    try:
                        relative_path = str(file_path.relative_to(settings.NOVEL_DIR))
                        content = await file_service_read_file(relative_path)
                        
                        # 使用统一的段落分割函数
                        paragraphs, _ = split_paragraphs(content)
                        for paragraph_num, paragraph in enumerate(paragraphs, 1):
                            if pattern.search(paragraph):
                                results.append({
                                    "file": str(file_path.relative_to(search_path)),
                                    "paragraph": paragraph_num,
                                    "content": paragraph.strip()
                                })
                    except Exception as e:
                        continue  # 跳过无法读取的文件
        else:
            return f"【工具结果】：路径不存在: {display_path}"
        
        if results:
            result_str = f"【工具结果】：在 '{display_path}' 中找到 {len(results)} 个匹配项：\n\n"
            for result in results:
                result_str += f"文件: {result['file']}:{result['paragraph']}\n"
                result_str += f"内容: {result['content']}\n\n"
            
            return result_str
        else:
            return f"【工具结果】：在 '{display_path}' 中没有找到匹配项"
            
    except Exception as e:
        return f"【工具结果】：搜索失败: {str(e)}"
