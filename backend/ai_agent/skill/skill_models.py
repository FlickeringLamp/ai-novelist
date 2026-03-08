"""
Skills 数据模型
定义 Skill 的数据结构和类型
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class SkillFrontmatter:
    """Skill 的 frontmatter 元数据"""
    
    name: str  # Skill 唯一标识
    description: str  # Skill 描述，决定何时触发
    
    @classmethod
    def from_dict(cls, data: dict) -> 'SkillFrontmatter':
        """从字典创建 SkillFrontmatter"""
        return cls(
            name=data.get('name', ''),
            description=data.get('description', '')
        )


@dataclass
class Skill:
    """Skill 完整数据结构"""
    
    name: str  # Skill 名称
    description: str  # Skill 描述
    base_dir: Path  # Skill 基础目录
    file_path: Path  # SKILL.md 文件路径
    frontmatter: SkillFrontmatter  # frontmatter 元数据
    content: str  # SKILL.md 的完整内容（不含 frontmatter）
    script_path: Optional[Path] = None  # 脚本文件路径（如果有）
    
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
