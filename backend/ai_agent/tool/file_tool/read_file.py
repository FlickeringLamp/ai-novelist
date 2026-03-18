from pydantic import BaseModel, Field
from typing import Optional
from langchain.tools import tool
from backend.file.file_service import read_file as file_service_read_file
from backend.ai_agent.utils.file_utils import split_paragraphs


class ReadFileInput(BaseModel):
    file_path: str = Field(description="文件路径")
    start_paragraph: Optional[int] = Field(default=None, description="起始段落号，为null默认从第1个段落开始")
    end_paragraph: Optional[int] = Field(default=None, description="结束段落号，为null默认到最后一个段落")


@tool(args_schema=ReadFileInput)
async def read_file(file_path: str, start_paragraph: Optional[int] = None,
               end_paragraph: Optional[int] = None) -> str:
    """
读取指定文件，返回的内容会自动添加段落编号，便于阅读
使用示例：
1. 读取完整文件
{
  "file_path": "第一章.md",
  "start_paragraph": null,
  "end_paragraph": null
}
2. 读取指定范围
{
  "file_path": "第一章.md",
  "start_paragraph": 10,
  "end_paragraph": 20
}
    """
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

        return f"【工具结果】：成功读取文件 '{file_path}'，共 {len(paragraphs)} 个段落：\n\n{numbered_content}"
    except Exception as e:
        return f"【工具结果】：读取文件失败: {str(e)}"

