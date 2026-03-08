"""
execute_skill 工具
让 AI 能够执行 Skill 的脚本
"""

from pydantic import BaseModel, Field
from langchain.tools import tool

from backend.ai_agent.skill.skill_loader import get_skill_loader
from backend.ai_agent.skill.script_executor import SkillScriptExecutor
from backend.config.config import settings


class ExecuteSkillInput(BaseModel):
    """执行 Skill 脚本的输入参数"""
    skill_name: str = Field(description="Skill 名称")
    args: str = Field(default="", description="传递给脚本的参数（可选）")


@tool(args_schema=ExecuteSkillInput)
async def execute_skill(skill_name: str, args: str = "") -> str:
    """执行 Skill 的脚本
    
    用于执行配置了脚本的 Skill。脚本可以是 Python、Node.js 或 Bash 脚本。
    执行时会自动注入配置的环境变量。
    
    Args:
        skill_name: Skill 名称
        args: 传递给脚本的参数（可选）
    """
    try:
        # 加载 Skill
        skill_loader = get_skill_loader()
        skill = skill_loader.load_all_skills().get(skill_name)
        
        if not skill:
            return f"错误：Skill '{skill_name}' 不存在"
        
        if not skill.script_path:
            return f"错误：Skill '{skill_name}' 没有配置脚本"
        
        # 获取环境变量
        executor = SkillScriptExecutor()
        env_overrides = executor.env_manager.get_skill_env(
            skill_name,
            settings.config
        )
        
        # 执行脚本
        result = await executor.execute_script(
            skill_name,
            skill.script_path,
            env_overrides,
            args
        )
        
        return f"【工具结果】：执行成功\n{result}"
        
    except Exception as e:
        return f"【工具结果】：执行失败 - {str(e)}"
