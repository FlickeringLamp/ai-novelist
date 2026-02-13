import os
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from langchain import tools
from langchain.tools import tool
from langgraph.types import interrupt,Command

class AskUserQuestionInput(BaseModel):
    """向用户提问的输入参数"""
    question: str = Field(description="问题内容")

@tool(args_schema=AskUserQuestionInput)
def ask_user_question(question: str) -> str:
    """向用户提问
    
    Args:
        question: 问题内容
    """
    # 构造包含工具具体信息的中断数据，与其他工具保持一致的格式
    interrupt_data = {
        "tool_name": "ask_user",
        "tool_display_name": "询问用户",
        "description": f"请回复: {question}",
        "question": question
    }
    user_choice = interrupt(interrupt_data)
    choice_action = "1" # 这里应该要默认批准功能
    choice_data = user_choice.get("choice_data", "无附加信息")
    # 无需选择批准或取消，等待用户输入信息后，直接返回用户回答
    return f"【工具结果】&【用户消息】：{choice_data}"
