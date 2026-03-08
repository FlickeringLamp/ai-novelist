"""
加载 Skill 工具
允许 AI 按需加载 Skill 的详细内容
"""

import logging
from pydantic import BaseModel, Field
from typing import Optional
from langchain.tools import tool

from backend.ai_agent.skill import get_skill_loader

logger = logging.getLogger(__name__)


class LoadSkillInput(BaseModel):
    """加载 Skill 的输入参数"""
    skill_name: str = Field(description="Skill 名称")


@tool(args_schema=LoadSkillInput)
async def load_skill(skill_name: str) -> str:
    """加载指定 Skill 的详细内容。
    
    当 AI 需要使用某个 Skill 时，调用此工具获取 Skill 的完整说明。
    
    可用的 Skills 可以从系统提示词中的 [可用 Skills] 部分查看。
    
    使用场景示例：
    {
        "skill_name": "code-review"
    }
    
    Args:
        skill_name: Skill 名称
        
    Returns:
        Skill 的完整内容（包含 frontmatter 和 body）
    """
    try:
        skill_loader = get_skill_loader()
        skill = skill_loader.load_all_skills().get(skill_name)
        
        if not skill:
            return f"【工具结果】：Skill '{skill_name}' 不存在"
        
        logger.info(f"加载 Skill: {skill_name}")
        content = skill.get_full_content()
        
        return f"【工具结果】：成功加载 Skill '{skill_name}'\n\n{content}"
        
    except Exception as e:
        logger.error(f"加载 Skill 失败 {skill_name}: {e}")
        return f"【工具结果】：加载 Skill 失败: {str(e)}"
