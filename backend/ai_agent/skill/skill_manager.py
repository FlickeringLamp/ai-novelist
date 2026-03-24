"""
Skill 统一管理器
整合了 Skill 的数据模型、脚本执行和加载功能
"""

import os
import re
import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Any

from backend.settings.settings import settings

logger = logging.getLogger(__name__)

@dataclass
class Skill:
    """Skill 完整数据结构"""
    
    name: str  # Skill 名称
    description: str  # Skill 描述
    base_dir: Path  # Skill 基础目录，即data/skills/下一层的目录
    file_path: Path  # SKILL.md 文件路径
    content: str  # SKILL.md 的完整内容（不含 frontmatter）
    
    def to_prompt_format(self) -> str:
        """将 Skill 转换为提示词格式
        
        Returns:
            格式化的 Skill 描述字符串
        """
        return f"- {self.name}: {self.description}"
    
    def get_full_content(self) -> str:
        """获取 Skill 的完整内容（包含 frontmatter）
        
        Returns:
            完整的 SKILL.md 内容
        """
        return self.content


class SkillLoader:
    """Skills 加载器"""
    
    def __init__(self):
        """初始化 Skills 加载器"""
        self.skills_dir = Path(settings.SKILLS_DIR).resolve()
    
    def _parse_frontmatter(self, content: str) -> Tuple[dict, str]:
        """解析 SKILL.md 文件的 frontmatter
        
        Args:
            content: SKILL.md 文件内容
            
        Returns:
            (frontmatter_dict, content_without_frontmatter)
        """
        # 匹配 --- 包围的 frontmatter
        pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
        match = re.match(pattern, content, re.DOTALL)
        
        if match:
            frontmatter_text = match.group(1)
            body_content = match.group(2)
            
            # 解析 frontmatter 为字典
            frontmatter_dict = {}
            for line in frontmatter_text.split('\n'):
                line = line.strip()
                if ':' in line:
                    key, value = line.split(':', 1)
                    frontmatter_dict[key.strip()] = value.strip()
            
            return frontmatter_dict, body_content
        else:
            # 没有 frontmatter，整个内容都是 body
            return {}, content
    
    def _load_skill_from_file(self, skill_dir: Path) -> Skill:
        """从单个 Skill 目录加载 Skill
        
        Args:
            skill_dir: Skill 目录路径
            
        Returns:
            Skill 对象
        """
        skill_md = skill_dir / "SKILL.md"
        
        # 读取文件内容
        with open(skill_md, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 解析 frontmatter
        frontmatter_dict, body_content = self._parse_frontmatter(content)
        
        # 从 frontmatter 获取 name 和 description
        name = frontmatter_dict.get('name', '')
        description = frontmatter_dict.get('description', '')
        
        # 创建 Skill 对象
        skill = Skill(
            name=name,
            description=description,
            base_dir=skill_dir,
            file_path=skill_md,
            content=body_content
        )
        
        logger.info(f"成功加载 Skill: {skill.name} from {skill_dir}")
        
        return skill
    
    def load_all_skills(self) -> Dict[str, Skill]:
        """加载所有 Skills
        
        Returns:
            Skill 名称到 Skill 对象的映射
        """
        skills_dict = {}
        
        # 遍历 skills 目录下的所有子目录
        for item in self.skills_dir.iterdir():
            if not item.is_dir():
                continue
            
            # 跳过隐藏目录
            if item.name.startswith('.'):
                continue
            
            # 加载 Skill
            skill = self._load_skill_from_file(item)
            skills_dict[skill.name] = skill
        
        logger.info(f"加载 Skills 完成，共 {len(skills_dict)} 个")
        return skills_dict
    
    def filter_skills(self, skill_names: List[str]) -> List[Skill]:
        """根据名称列表过滤 Skills
        
        Args:
            skill_names: Skill 名称列表
            
        Returns:
            过滤后的 Skill 对象列表
        """
        # 加载所有 Skills
        all_skills = self.load_all_skills()
        
        result = []
        for name in skill_names:
            skill = all_skills.get(name)
            if skill:
                result.append(skill)
            else:
                logger.warning(f"Skill 不存在: {name}")
        
        return result
    
    def format_skills_for_prompt(self, skills: List[Skill]) -> str:
        """将 Skills 列表格式化为提示词
        
        Args:
            skills: Skill 对象列表
            
        Returns:
            格式化的 Skills 提示词
        """
        if not skills:
            return ""
        
        parts = ["[可用 Skills]:"]
        for skill in skills:
            parts.append(skill.to_prompt_format())
        
        return "\n".join(parts)


_skill_loader_instance = None


def get_skill_loader() -> SkillLoader:
    """获取全局 SkillLoader 单例
    
    Returns:
        SkillLoader 实例
    """
    global _skill_loader_instance
    if _skill_loader_instance is None:
        _skill_loader_instance = SkillLoader()
    return _skill_loader_instance
