from pydantic import BaseModel, Field
from typing import Optional
from langchain.tools import tool
from langgraph.types import interrupt
from backend.file.file_service import read_file as file_service_read_file
from backend.ai_agent.utils.file_utils import split_paragraphs


class ReadFileInput(BaseModel):
    """读取文件的输入参数"""
    file_path: str = Field(description="文件路径")
    start_paragraph: Optional[int] = Field(default=None, description="起始段落号")
    end_paragraph: Optional[int] = Field(default=None, description="结束段落号")


@tool(args_schema=ReadFileInput)
async def read_file(file_path: str, start_paragraph: Optional[int] = None,
               end_paragraph: Optional[int] = None) -> str:
    """读取文件内容，支持指定段落范围。
    使用场景示例：
    1. 读取整个文件
    {
        "file_path": "第一章.md"
    }
    2. 读取指定段落范围
    {
        "file_path": "第一章.md",
        "start_paragraph": 5,
        "end_paragraph": 15
    }
    3. 从第10段读到文件末尾
    {
        "file_path": "第一章.md",
        "start_paragraph": 10
    }
    4. 读取文件开头到第20段
    {
        "file_path": "第一章.md",
        "end_paragraph": 20
    }
    
    重要说明：
    1. start_paragraph: 不指定时默认从第1个段落开始
    2. end_paragraph: 不指定时默认到最后一个段落
    3. 返回的内容会自动添加段落编号

    Args:
        file_path: 文件路径
        start_paragraph: 起始段落
        end_paragraph: 结束段落
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
            content = await file_service_read_file(file_path)

            # 使用统一的段落分割函数
            paragraphs, paragraph_ending = split_paragraphs(content)
            # 先给所有段落编号
            numbered_paragraphs = [f"{i+1} | {p}" for i, p in enumerate(paragraphs)]
            # 再根据段落范围筛选
            if start_paragraph is not None or end_paragraph is not None:
                start = start_paragraph or 1
                end = end_paragraph or len(numbered_paragraphs)
                numbered_paragraphs = numbered_paragraphs[start-1:end]
            numbered_content = paragraph_ending.join(numbered_paragraphs)

            return f"【工具结果】：成功读取文件 '{file_path}'，共 {len(paragraphs)} 个段落：\n\n{numbered_content} ;**【用户信息】：{choice_data}**"
        except Exception as e:
            return f"【工具结果】：读取文件失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：读取失败，用户取消了工具调用 ;**【用户信息】：{choice_data}**"

