import os
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from langchain.tools import tool
from langgraph.types import Command, interrupt

# 导入配置和路径验证器
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
from backend.config import settings
from file.utils.path_validator import PathValidator

class WriteFileInput(BaseModel):
    """写入文件的输入参数"""
    path: str = Field(description="文件路径")
    content: str = Field(description="文件内容")

@tool(args_schema=WriteFileInput)
def write_file(path: str, content: str) -> str:
    """创建文件并写入内容。注意：1. 如果文件已存在，使用write_file会导致所有内容被覆盖，建议先用read工具了解内容再使用此工具。2. 如果文件不存在，将会创建新文件并写入内容
    
    Args:
        path: 文件路径（相对于novel目录的相对路径）
        content: 文件内容
    """
    # 构造包含工具具体信息的中断数据
    interrupt_data = {
        "tool_name": "write_file",
        "tool_display_name": "写入文件",
        "description": f"写入文件: {path} ({len(content)} 字符)",
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
            # 初始化路径验证器
            path_validator = PathValidator(settings.NOVEL_DIR)
            
            # 规范化路径
            clean_path = path_validator.normalize_path(path)
            
            # 验证路径安全性
            if not path_validator.is_safe_path(clean_path):
                return f"【工具结果】：写入失败，不安全的文件路径: {path} ;**【用户信息】：{choice_data}**"
                
            # 获取完整路径
            full_path = path_validator.get_full_path(clean_path)
            
            # 确保目录存在
            full_path.parent.mkdir(parents=True, exist_ok=True)
        
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
            return f"【工具结果】：文件 '{path}' 写入成功，内容长度: {len(content)} 字符 ;**【用户信息】：{choice_data}**"
        
        except Exception as e:
            return f"【工具结果】：写入文件失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户拒绝了工具请求 ;**【用户信息】：{choice_data}**"