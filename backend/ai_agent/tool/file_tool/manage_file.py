from pydantic import BaseModel, Field
from typing import Optional
from langchain.tools import tool
from backend.file.file_service import update_file, delete_file

class ManageFileInput(BaseModel):
    path: str = Field(description="文件的路径（推荐.md后缀，也允许其他后缀）")
    content: Optional[str] = Field(default=None, description="文件内容，为null时执行删除文件")

@tool(args_schema=ManageFileInput)
async def manage_file(path: str, content: Optional[str]) -> str:
    """
创建/删除/重写文件
使用场景示例：
1. 创建并写入内容（如果目标路径文件已经存在，则视为重写文件）
{
  "path": "新建文件夹/新章节.md",
  "content": "这是新章节的内容"
}
2. 删除文件
{
  "path": "新建文件夹/废弃章节.md",
  "content": null
}
    """
    try:
        # 如果content为None，删除文件
        if content is None:
            await delete_file(path)
            return f"【工具结果】：文件 '{path}' 删除成功"
        
        # 写入文件内容
        await update_file(path, content)
        return f"【工具结果】：文件 '{path}' 写入成功，内容长度: {len(content)} 字符"
    
    except Exception as e:
        return f"【工具结果】：操作文件失败: {str(e)}"
