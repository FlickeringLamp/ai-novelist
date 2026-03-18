from pydantic import BaseModel, Field
from langchain.tools import tool

class AskUserQuestionInput(BaseModel):
    question: str = Field(description="问题内容")

@tool(args_schema=AskUserQuestionInput)
async def ask_user_question() -> str:
    """
向用户提问，当不确定用户意图时使用。建议适当多用，确保对用户意图理解准确
    """
    return f"【工具结果】：执行成功"
