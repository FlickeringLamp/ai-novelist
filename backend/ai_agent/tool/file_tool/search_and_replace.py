import re
from pydantic import BaseModel, Field
from langchain.tools import tool
from langgraph.types import interrupt
from backend.file.file_service import read_file as file_service_read_file
from backend.file.file_service import update_file as file_service_update_file


class SearchAndReplaceInput(BaseModel):
    """搜索替换的输入参数"""
    path: str = Field(description="文件路径")
    search: str = Field(description="搜索文本（正则表达式）")
    replace: str = Field(description="替换文本")

@tool(args_schema=SearchAndReplaceInput)
async def search_and_replace(path: str, search: str, replace: str) -> str:
    """搜索并替换文本(单文件)
    使用场景示例：
    1. 简单文本替换
    {
        "path": "第一章.md",
        "search": "张三",
        "replace": "李四"
    }
    2. 使用正则表达式替换
    {
        "path": "第一章.md",
        "search": "\\d{4}年\\d{1,2}月\\d{1,2}日",
        "replace": "2024年1月1日"
    }
    
    重要说明：
    1. search参数为正则表达式，请参考Python re模块语法
    2. 会替换文件中所有匹配的文本
    3. 如需匹配特殊字符（如. * ? + [] () $ ^等），请使用反斜杠转义

    Args:
        path: 文件路径
        search: 搜索文本
        replace: 替换文本
    """
    # 构造包含工具具体信息的中断数据
    interrupt_data = {
        "tool_name": "search_and_replace",
        "tool_display_name": "搜索替换",
        "description": f"搜索替换: {path} (\"{search}\" -> \"{replace}\")",
        "parameters": {
            "path": path,
            "search": search,
            "replace": replace
        }
    }
    user_choice = interrupt(interrupt_data)
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            content = await file_service_read_file(path)
            
            pattern = re.compile(search)
            new_content = pattern.sub(replace, content)
            
            await file_service_update_file(path, new_content)
            
            return f"【工具结果】：在文件 '{path}' 中成功完成搜索替换操作 ;**【用户信息】：{choice_data}**"
        
        except Exception as e:
            return f"【工具结果】：搜索替换失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户拒绝了工具请求 ;**【用户信息】：{choice_data}**"
