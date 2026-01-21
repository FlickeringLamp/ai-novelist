from pathlib import Path
from pydantic import BaseModel, Field
from langchain.tools import tool
from langgraph.types import interrupt

class InsertContentInput(BaseModel):
    """插入内容的输入参数"""
    path: str = Field(description="文件路径（相对于novel目录的相对路径）")
    paragraph: int = Field(description="段落号")
    content: str = Field(description="要插入的内容")

@tool(args_schema=InsertContentInput)
def insert_content(path: str, paragraph: int, content: str) -> str:
    """在指定位置插入内容
    
    Args:
        path: 文件路径（相对于novel目录的相对路径）
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
            file_path = Path(path)
            
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_content = f.read()
            
            lines = existing_content.split('\n')
            
            if paragraph == 0:  # 在文件末尾追加
                lines.append(content)
            else:
                # 在指定段落插入
                insert_pos = min(max(0, paragraph - 1), len(lines))
                lines.insert(insert_pos, content)
            
            new_content = '\n'.join(lines)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            return f"【工具结果】：内容已成功插入到文件 '{path}' 的第 {paragraph} 段 ;**【用户信息】：{choice_data}**"
        except Exception as e:
            return f"【工具结果】：插入内容失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户取消了工具请求 ;**【用户信息】：{choice_data}**"
