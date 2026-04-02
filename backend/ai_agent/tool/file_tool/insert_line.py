from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.file.file_service import read_file as file_service_read_file
from backend.file.file_service import update_file as file_service_update_file
from backend.ai_agent.utils.file_utils import split_paragraphs


class InsertItem(BaseModel):
    paragraph: int = Field(description="插入段落号")
    content: str = Field(description="要插入的新内容")


class InsertLineInput(BaseModel):
    path: str = Field(description="文件路径")
    inserts: list[InsertItem] = Field(description="要插入的段落列表，每个元素包含paragraph和content")


@tool(args_schema=InsertLineInput)
async def insert_line(path: str, inserts: list[dict]) -> str:
    """
在指定位置批量插入新段落（支持一次性插入多个段落）
使用示例：
{
  "path": "第一章.md",
  "inserts": [
    {"paragraph": 3, "content": "这是插入到段落3的内容"},
    {"paragraph": 5, "content": "这是插入到段落5的内容"}
  ]
}
如果需要插入多个相邻段落，统一使用同一个目标段落号
{
  "path": "第一章.md",
  "inserts": [
    {"paragraph": 6, "content": "这是第一行内容"},
    {"paragraph": 6, "content": "这是第二行内容"}
  ]
}
    """
    try:
        original_content = await file_service_read_file(path)
        paragraphs, paragraph_ending = split_paragraphs(original_content)
        
        # 按段落号降序排序，从后往前插入，避免行号偏移
        sorted_inserts = sorted(inserts, key=lambda x: x.paragraph, reverse=True)
        
        inserted_count = 0
        for item in sorted_inserts:
            paragraph = item.paragraph
            content = item.content
            
            # 大于长度=末尾，其他=指定位置前（paragraph=1时插入到开头）
            insert_pos = min(paragraph - 1, len(paragraphs))
            paragraphs.insert(insert_pos, content)
            inserted_count += 1
        
        await file_service_update_file(path, paragraph_ending.join(paragraphs))
        
        return f"【工具结果】：成功在 '{path}' 插入 {inserted_count} 个段落"
        
    except Exception as e:
        return f"【工具结果】：操作失败: {str(e)}"
