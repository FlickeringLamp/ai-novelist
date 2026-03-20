"""
加载/卸载 Skill 工具
允许 AI 按需加载或卸载 Skill 的详细内容
"""

import logging
from pydantic import BaseModel, Field
from langchain.tools import tool

from backend.config.config import settings
from backend.ai_agent.skill import get_skill_loader
from backend.file.file_service import normalize_to_absolute

logger = logging.getLogger(__name__)


class LoadUnloadSkillInput(BaseModel):
    skill_name: str = Field(description="Skill 名称")


@tool(args_schema=LoadUnloadSkillInput)
async def load_unload_skill(skill_name: str) -> str:
    """
    加载或卸载 Skill 到AI上下文中
    
    功能说明：
    - 如果 Skill 不在[额外 Skill 内容]列表中，使用此工具可以将该 Skill 的详细内容加载到末尾附加消息
    - 如果 Skill 已在[额外 Skill 内容]列表中，使用此工具可以卸载 Skill 内容，节省上下文
    - 已加载的 Skill 内容会作为末尾附加消息，不会污染系统提示词
    - Skill 内容由 SKILL.md 文件提供
    
    使用示例：
    {
      "skill_name": "baidu-search"
    }
    """
    try:
        # 获取当前模式
        current_mode = settings.get_config("currentMode", default="outline")
        
        # 获取当前模式的 skillPaths 列表（存储 SKILL.md 文件的绝对路径）
        skill_paths = settings.get_config("mode", current_mode, "skillPaths", default=[])
        
        # 确保 skill_paths 是列表
        if not isinstance(skill_paths, list):
            skill_paths = []
        
        # 使用 SkillLoader 获取 Skill 信息
        skill_loader = get_skill_loader()
        all_skills = skill_loader.load_all_skills()
        
        # 检查 Skill 是否存在
        skill = all_skills.get(skill_name)
        if not skill:
            return f"【工具结果】：失败 - Skill '{skill_name}' 不存在"
        
        # 获取 Skill 的 SKILL.md 文件绝对路径
        skill_md_path = str(skill.file_path.resolve())
        
        # 检查 Skill 是否已在 skillPaths 中
        if skill_md_path in skill_paths:
            # Skill 已存在，执行卸载操作
            skill_paths.remove(skill_md_path)
            
            # 更新配置
            settings.update_config(skill_paths, "mode", current_mode, "skillPaths")
            
            logger.info(f"卸载 Skill: {skill_name}")
            return f"【工具结果】：成功卸载 Skill '{skill_name}'"
        else:
            # Skill 不存在，执行加载操作
            # 添加到 skillPaths 列表
            skill_paths.append(skill_md_path)
            
            # 更新配置
            settings.update_config(skill_paths, "mode", current_mode, "skillPaths")
            
            logger.info(f"加载 Skill: {skill_name}")
            return f"【工具结果】：成功加载 Skill '{skill_name}'"
            
    except Exception as e:
        logger.error(f"加载/卸载 Skill 失败 {skill_name}: {e}")
        return f"【工具结果】：失败 - {str(e)}"
