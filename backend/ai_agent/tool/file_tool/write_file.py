from pydantic import BaseModel, Field
from typing import Union, Optional
from langchain.tools import tool
from langgraph.types import interrupt
from backend.file.file_service import update_file, delete_file

class WriteFileInput(BaseModel):
    """写入文件的输入参数"""
    path: str = Field(description="文件路径")
    content: Optional[str] = Field(default=None, description="文件内容，不填写此字段时删除文件")

@tool(args_schema=WriteFileInput)
async def write_file(path: str, content: Optional[str]) -> str:
    """写入内容（兼创建/删除文件）    
    使用场景示例：
    1. 写入内容
    {
        "path": "新建文件夹/新章节.md",
        "content": "这是新章节的内容"
    }
    2. 删除文件
    {
        "path": "新建文件夹/废弃章节.md"
    }
    
    重要说明：
    1. 文件使用.md后缀
    2. 如果文件已存在于"[当前工作区文件结构 (novel 目录)]"，使用write_file会导致所有内容被覆盖，请确保你想覆盖所有内容，否则不要使用此工具。
    3. 如果文件不存在，将会创建新文件并写入内容
    4. 如果不填写content字段，将会删除文件

    Args:
        path: 文件路径
        content: 文件内容
    """
    # 构造包含工具具体信息的中断数据
    # 构造描述信息
    if content is None:
        description = f"删除文件: {path}"
    else:
        description = f"写入文件: {path} ({len(content)} 字符)"
    
    interrupt_data = {
        "tool_name": "write_file",
        "tool_display_name": "写入文件",
        "description": description,
        "parameters": {
            "path": path,
            "content": content
        }
    }
    user_choice = interrupt(interrupt_data)
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            # 如果content为None，删除文件
            if content is None:
                await delete_file(path)
                return f"【工具结果】：文件 '{path}' 删除成功 ;**【用户信息】：{choice_data}**"
            
            # 写入文件内容
            await update_file(path, content)
            return f"【工具结果】：文件 '{path}' 写入成功，内容长度: {len(content)} 字符 ;**【用户信息】：{choice_data}**"
        
        except Exception as e:
            return f"【工具结果】：操作文件失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户拒绝了工具请求 ;**【用户信息】：{choice_data}**"
