"""
Skills 模块
提供基于文件系统的模块化能力插件功能
"""

from backend.ai_agent.skill.skill_manager import SkillLoader, get_skill_loader

__all__ = [
    "SkillLoader",
    "get_skill_loader",
]
