"""
Skill 环境变量管理器
负责注入和清理环境变量
"""

import os
from typing import Dict
from contextlib import contextmanager


class SkillEnvManager:
    """Skill 环境变量管理器"""
    
    @contextmanager
    def apply_env_overrides(self, env_overrides: Dict[str, str]):
        """应用环境变量（上下文管理器）
        
        Args:
            env_overrides: 要应用的环境变量字典
            
        Yields:
            None
        """
        # 保存原始值
        original_values = {}
        for key, value in env_overrides.items():
            original_values[key] = os.environ.get(key)
            os.environ[key] = value
        
        try:
            yield
        finally:
            # 恢复原始值
            for key, original_value in original_values.items():
                if original_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = original_value
    
    def get_skill_env(self, skill_name: str, config: Dict) -> Dict[str, str]:
        """从配置获取 Skill 的环境变量
        
        Args:
            skill_name: Skill 名称
            config: 配置字典
            
        Returns:
            环境变量字典
        """
        skill_config = config.get("skills", {}).get("entries", {}).get(skill_name, {})
        env = {}
        
        # 添加 apiKey
        if "apiKey" in skill_config:
            env["API_KEY"] = skill_config["apiKey"]
        
        # 添加其他环境变量
        if "env" in skill_config:
            env.update(skill_config["env"])
        
        return env
