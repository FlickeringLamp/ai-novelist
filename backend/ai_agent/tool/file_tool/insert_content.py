from pydantic import BaseModel, Field
from langchain.tools import tool
from langgraph.types import interrupt
from backend.file.file_service import read_file as file_service_read_file
from backend.file.file_service import update_file as file_service_update_file
from backend.ai_agent.utils.file_utils import split_paragraphs

class InsertContentInput(BaseModel):
    """插入内容的输入参数"""
    path: str = Field(description="文件路径")
    paragraph: int = Field(description="段落号")
    content: str = Field(description="要插入的内容")

@tool(args_schema=InsertContentInput)
async def insert_content(path: str, paragraph: int, content: str) -> str:
    """在指定位置插入内容
    使用场景示例：
    1. 开头插入内容：
    {
        "path": "第一章.md",
        "paragraph": 1,
        "content": "这是新增的序言内容"
    }
    2. 末尾追加内容
    {
        "path": "第一章.md",
        "paragraph": 0,
        "content": "这是追加到末尾的内容"
    }
    3. 指定段落前插入内容
    {
        "path": "第一章.md",
        "paragraph": 10,
        "content": "这是插入到第10段之前的新段落"
    }
    
    重要说明：
    1. paragraph=1表示在文件开头插入
    2. paragraph=0表示在文件末尾追加
    3. paragraph大于1时，在指定段落之前插入新内容

    Args:
        path: 文件路径
        paragraph: 段落号
        content: 要插入的内容
    """
    # 构造包含工具具体信息的中断数据
    interrupt_data = {
        "tool_name": "insert_content",
        "tool_display_name": "插入内容",
        "description": f"插入内容到文件: {path} (位置: {paragraph})",
        "parameters": {
            "path": path,
            "paragraph": paragraph,
            "content": content
        }
    }
    user_choice = interrupt(interrupt_data)
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            existing_content = await file_service_read_file(path)
            
            # 使用统一的段落分割函数
            lines, paragraph_ending = split_paragraphs(existing_content)
            
            if paragraph == 0:  # 在文件末尾追加
                lines.append(content)
            else:
                # 在指定段落插入
                insert_pos = min(max(0, paragraph - 1), len(lines))
                lines.insert(insert_pos, content)
            
            # 使用检测到的换行符连接段落
            new_content = paragraph_ending.join(lines)
            
            await file_service_update_file(path, new_content)
            
            return f"【工具结果】：内容已成功插入到文件 '{path}' 的第 {paragraph} 段 ;**【用户信息】：{choice_data}**"
        except Exception as e:
            return f"【工具结果】：插入内容失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户取消了工具请求 ;**【用户信息】：{choice_data}**"
