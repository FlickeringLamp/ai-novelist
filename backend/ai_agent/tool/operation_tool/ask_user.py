from pydantic import BaseModel, Field
from langchain.tools import tool

class AskUserQuestionInput(BaseModel):
    """向用户提问的输入参数"""
    question: str = Field(description="问题内容")

@tool(args_schema=AskUserQuestionInput)
async def ask_user_question() -> str:
    """向用户提问
    当不确定用户意图时使用，建议适当多用

    Args:
        question: 问题内容
    """
    return f"【工具结果】：执行成功"
