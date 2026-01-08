import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional
from langchain.tools import tool, ToolRuntime
from langgraph.types import interrupt


class SearchAndReplaceInput(BaseModel):
    """搜索替换的输入参数"""
    path: str = Field(description="文件路径")
    search: str = Field(description="搜索文本")
    replace: str = Field(description="替换文本")
    use_regex: bool = Field(default=False, description="是否使用正则表达式")
    ignore_case: bool = Field(default=False, description="是否忽略大小写")

@tool(args_schema=SearchAndReplaceInput)
def search_and_replace(path: str, search: str, replace: str,
                           use_regex: bool = False, ignore_case: bool = False,
                           runtime: Optional[ToolRuntime] = None) -> str:
    """搜索并替换文本
    
    Args:
        path: 文件路径
        search: 搜索文本
        replace: 替换文本
        use_regex: 是否使用正则表达式
        ignore_case: 是否忽略大小写
        runtime: LangChain运行时上下文
    """
    # 构造包含工具具体信息的中断数据
    interrupt_data = {
        "tool_name": "search_and_replace",
        "tool_display_name": "搜索替换",
        "description": f"搜索替换: {path} (\"{search}\" -> \"{replace}\")",
        "parameters": {
            "path": path,
            "search": search,
            "replace": replace,
            "use_regex": use_regex,
            "ignore_case": ignore_case
        }
    }
    user_choice = interrupt(interrupt_data)
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            full_path = Path(path)
            
            # 检查文件是否存在
            if not full_path.exists():
                return f"【工具结果】：错误：文件 '{path}' 不存在 ;**【用户信息】：{choice_data}**"
            
            # 检查是否为文件而非目录
            if not full_path.is_file():
                return f"【工具结果】：错误：'{path}' 不是一个文件 ;**【用户信息】：{choice_data}**"
            
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if use_regex:
                flags = re.IGNORECASE if ignore_case else 0
                pattern = re.compile(search, flags)
                new_content = pattern.sub(replace, content)
            else:
                if ignore_case:
                    # 简单的忽略大小写替换
                    pattern = re.compile(re.escape(search), re.IGNORECASE)
                    new_content = pattern.sub(replace, content)
                else:
                    new_content = content.replace(search, replace)
            
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            return f"【工具结果】：在文件 '{path}' 中成功完成搜索替换操作 ;**【用户信息】：{choice_data}**"
        
        except Exception as e:
            return f"【工具结果】：搜索替换失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户拒绝了工具请求 ;**【用户信息】：{choice_data}**"