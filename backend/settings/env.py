"""
环境变量管理模块
负责 .env 文件的解析、加载、保存等操作
"""
import logging
import os
import re
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def parse_env_line(line: str) -> tuple[str, str] | None:
    """解析单行 env 文件内容"""
    line = line.strip()
    
    # 跳过空行和注释
    if not line or line.startswith('#'):
        return None
    
    # 解析 KEY=value 格式
    match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$', line)
    if not match:
        return None
    
    key = match.group(1)
    value = match.group(2).strip()
    
    # 处理引号包裹的值
    if value.startswith('"') and value.endswith('"') and len(value) >= 2:
        value = value[1:-1]
    elif value.startswith("'") and value.endswith("'") and len(value) >= 2:
        value = value[1:-1]
    
    return key, value


def load_env_file(env_file: Path) -> Dict[str, str]:
    """
    加载 .env 文件到环境变量
    
    Args:
        env_file: .env 文件路径
    """
    env_vars = {}
    
    try:
        with open(env_file, 'r', encoding='utf-8') as f:
            # 同时获取索引和值
            for line_num, line in enumerate(f, 1):
                try:
                    result = parse_env_line(line)
                    if result:
                        key, value = result
                        env_vars[key] = value
                        # 同时设置到 os.environ
                        os.environ[key] = value
                except Exception as e:
                    logger.warning(f"解析 .env 文件第 {line_num} 行失败: {e}")
                    continue
        
        logger.info(f"成功加载 .env 文件: {env_file}")
    except Exception as e:
        logger.error(f"加载 .env 文件失败: {e}")
    
    return env_vars


def format_env_value(value: str) -> str:
    """格式化环境变量值，处理特殊字符"""
    # 如果值已经包含引号，保持原样
    if (value.startswith('"') and value.endswith('"')) or \
       (value.startswith("'") and value.endswith("'")):
        return value
    
    # 如果值包含空格、换行或特殊字符，添加双引号
    if re.search(r'[\s\n\r#="\']', value):
        # 转义双引号
        escaped_value = value.replace('"', '\\"')
        return f'"{escaped_value}"'
    
    return value


def save_env_file(env_file: Path, env_vars: Dict[str, str] = None) -> bool:
    """
    保存环境变量到 .env 文件
    
    Args:
        env_file: .env 文件路径
        env_vars: 环境变量字典
    """
    try:
        lines = []
        
        # 统一处理所有环境变量
        for key, value in sorted(env_vars.items()):
            formatted_value = format_env_value(value)
            lines.append(f"{key}={formatted_value}")
            lines.append("")
        
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        logger.info(f"成功保存 .env 文件: {env_file}")
        return True
        
    except Exception as e:
        logger.error(f"保存 .env 文件失败: {e}")
        return False


class EnvManager:
    """
    环境变量管理器
    封装了对 .env 文件的操作
    """
    
    def __init__(self, env_file_path: Path):
        self.env_file_path = env_file_path
        # 启动时自动加载 .env 文件到环境变量
        self._load_env_on_startup()
    
    def _load_env_on_startup(self):
        """启动时将 .env 文件中的所有变量加载到 os.environ"""
        if self.env_file_path.exists():
            load_env_file(self.env_file_path)
            logger.info(f"启动时加载环境变量文件: {self.env_file_path}")
    
    def get_api_key(self, env_key: str) -> Optional[str]:
        """从环境变量获取值"""
        # 首先检查 os.environ
        if env_key in os.environ:
            return os.environ[env_key]
        
        # 尝试从 .env 文件加载
        env_vars = load_env_file(self.env_file_path)
        
        return env_vars.get(env_key)
    
    def set_api_key(self, env_key: str, api_key: str) -> bool:
        """设置值到环境变量"""
        # 加载现有的环境变量
        env_vars = load_env_file(self.env_file_path)
        
        # 更新环境变量
        env_vars[env_key] = api_key
        
        # 同时更新当前进程的环境变量
        os.environ[env_key] = api_key
        
        # 保存到文件
        return save_env_file(self.env_file_path, env_vars)
    
    def remove_api_key(self, env_key: str) -> bool:
        """从环境变量移除值"""
        # 加载现有的环境变量
        env_vars = load_env_file(self.env_file_path)
        
        # 如果存在则移除
        if env_key in env_vars:
            del env_vars[env_key]
            
            # 同时移除当前进程的环境变量
            if env_key in os.environ:
                del os.environ[env_key]
        
        # 保存到文件
        return save_env_file(self.env_file_path, env_vars)
