import os
import re
from pydantic import BaseModel, Field
from langchain.tools import tool
from langgraph.types import interrupt

# 导入配置和路径验证器
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
from backend.config import settings
from file.utils.path_validator import PathValidator

class SearchFilesInput(BaseModel):
    """搜索文件的输入参数"""
    path: str = Field(description="搜索目录（相对于novel目录的相对路径）")
    regex: str = Field(description="正则表达式")

@tool(args_schema=SearchFilesInput)
def search_file(path: str, regex: str) -> str:
    """在指定文件或目录下搜索内容
    
    Args:
        path: 文件路径或搜索目录（相对于novel目录的相对路径）
        regex: 正则表达式
    """
    # 构造包含工具具体信息的中断数据
    interrupt_data = {
        "tool_name": "search_file",
        "tool_display_name": "搜索文件",
        "description": f"搜索文件: {path} (模式: {regex})",
        "parameters": {
            "path": path,
            "regex": regex
        }
    }
    user_choice = interrupt(interrupt_data)
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            # 初始化路径验证器
            path_validator = PathValidator(settings.NOVEL_DIR)
            
            # 规范化路径
            clean_path = path_validator.normalize_path(path)
            
            # 验证路径安全性
            if not path_validator.is_safe_path(clean_path):
                return f"【工具结果】：搜索失败，不安全的文件路径: {path} ;**【用户信息】：{choice_data}**"
                
            # 获取完整路径
            search_path = path_validator.get_full_path(clean_path)
            
            pattern = re.compile(regex)
            results = []
            
            if search_path.is_file():
                # 搜索单个文件
                try:
                    with open(search_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    lines = content.split('\n')
                    for line_num, line in enumerate(lines, 1):
                        if pattern.search(line):
                            results.append({
                                "file": str(search_path),
                                "line": line_num,
                                "content": line.strip()
                            })
                except Exception as e:
                    return f"【工具结果】：读取文件失败: {str(e)} ;**【用户信息】：{choice_data}**"
                    
            elif search_path.is_dir():
                # 递归搜索目录中的所有文件
                for file_path in search_path.rglob("*"):
                    if file_path.is_file():
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            lines = content.split('\n')
                            for line_num, line in enumerate(lines, 1):
                                if pattern.search(line):
                                    results.append({
                                        "file": str(file_path.relative_to(search_path)),
                                        "line": line_num,
                                        "content": line.strip()
                                    })
                        except Exception as e:
                            continue  # 跳过无法读取的文件
            else:
                return f"【工具结果】：路径不存在: {path} ;**【用户信息】：{choice_data}**"
            
            if results:
                result_str = f"【工具结果】：在 '{path}' 中找到 {len(results)} 个匹配项：\n\n"
                for result in results[:10]:  # 最多显示10个结果
                    result_str += f"文件: {result['file']}:{result['line']}\n"
                    result_str += f"内容: {result['content']}\n\n"
                
                if len(results) > 10:
                    result_str += f"... 还有 {len(results) - 10} 个匹配项未显示"
                
                return result_str + f" ;**【用户信息】：{choice_data}**"
            else:
                return f"【工具结果】：在 '{path}' 中没有找到匹配项 ;**【用户信息】：{choice_data}**"
                
        except Exception as e:
            return f"【工具结果】：搜索失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户取消工具调用 ;**【用户信息】：{choice_data}**"