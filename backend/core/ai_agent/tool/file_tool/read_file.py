import os
from pydantic import BaseModel, Field
from typing import Optional
from langchain.tools import tool
from langgraph.types import interrupt

# 导入配置和路径验证器
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
from backend.config import settings
from backend.core.file.file_service import normalize_path, get_full_path

class ReadFileInput(BaseModel):
    """读取文件的输入参数"""
    file_path: str = Field(description="文件路径")
    start_paragraph: Optional[int] = Field(default=None, description="起始段落号")
    end_paragraph: Optional[int] = Field(default=None, description="结束段落号")


@tool(args_schema=ReadFileInput)
def read_file(file_path: str, start_paragraph: Optional[int] = None,
               end_paragraph: Optional[int] = None) -> str:
    """读取文件内容，支持指定段落范围
    Args:
        file_path: 文件路径（相对于novel目录的相对路径）
        start_paragraph: 起始段落号
        end_paragraph: 结束段落号
    """
    # 构造包含工具具体信息的中断数据
    interrupt_data = {
        "tool_name": "read_file",
        "tool_display_name": "读取文件",
        "description": f"读取文件: {file_path}",
        "parameters": {
            "file_path": file_path,
            "start_paragraph": start_paragraph,
            "end_paragraph": end_paragraph
        }
    }
    user_choice = interrupt(interrupt_data)
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            # 规范化路径
            clean_path = normalize_path(file_path)
            
            # 获取完整路径
            full_path = get_full_path(clean_path)
            
            # 读取文件内容
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 按段落分割并添加行号
            paragraphs = content.split('\n')
            if start_paragraph is not None or end_paragraph is not None:
                start = start_paragraph or 1
                end = end_paragraph or len(paragraphs)
                paragraphs = paragraphs[start-1:end]
            numbered_content = "\n".join([f"{i+1} | {p}" for i, p in enumerate(paragraphs)])

            return f"【工具结果】：成功读取文件 '{file_path}'，共 {len(paragraphs)} 个段落：\n\n{numbered_content} ;**【用户信息】：{choice_data}**"
        except Exception as e:
            return f"【工具结果】：读取文件失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：读取失败，用户取消了工具调用 ;**【用户信息】：{choice_data}**"