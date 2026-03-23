"""
环境变量管理模块
负责管理 .env 文件的读取、写入和更新
支持 PyInstaller 打包环境和开发环境
"""

import os
import sys
import re
import logging
from pathlib import Path
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)

# 环境变量名前缀，用于区分不同提供商的 API KEY
ENV_PREFIX = "AI_NOVELIST_"


def get_env_file_path() -> Path:
    """
    获取 .env 文件路径
    支持开发环境和 PyInstaller 打包环境
    """
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后的环境 - 使用可执行文件所在目录
        base_dir = Path(os.path.dirname(sys.executable))
    else:
        # 开发环境 - 项目根目录
        base_dir = Path(__file__).parent.parent.parent
    
    return base_dir / ".env"


def parse_env_line(line: str) -> tuple[str, str] | None:
    """
    解析 .env 文件的一行，返回 (key, value) 元组
    支持以下格式：
    - KEY=value
    - KEY="value"
    - KEY='value'
    - 空行和注释 (# 开头) 返回 None
    """
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


def format_env_value(value: str) -> str:
    """
    格式化环境变量值用于写入 .env 文件
    如果值包含空格或特殊字符，则添加引号
    """
    # 如果值已经包含引号，保持原样
    if (value.startswith('"') and value.endswith('"')) or \
       (value.startswith("'") and value.endswith("'")):
        return value
    
    # 如果值包含空格、换行或特殊字符，添加双引号
    if re.search(r'[\s\n\r#=\"\']', value):
        # 转义双引号
        escaped_value = value.replace('"', '\\"')
        return f'"{escaped_value}"'
    
    return value


def load_env_file() -> Dict[str, str]:
    """
    加载 .env 文件中的所有环境变量
    
    Returns:
        Dict[str, str]: 环境变量字典
    """
    env_file = get_env_file_path()
    env_vars = {}
    
    if not env_file.exists():
        logger.info(f".env 文件不存在: {env_file}")
        return env_vars
    
    try:
        with open(env_file, 'r', encoding='utf-8') as f:
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


def save_env_file(env_vars: Dict[str, str], comments: Optional[Dict[str, str]] = None) -> bool:
    """
    保存环境变量到 .env 文件
    
    Args:
        env_vars: 要保存的环境变量字典
        comments: 可选的注释字典 {key: comment}
    
    Returns:
        bool: 保存成功返回 True
    """
    env_file = get_env_file_path()
    
    try:
        # 确保目录存在
        env_file.parent.mkdir(parents=True, exist_ok=True)
        
        lines = []
        
        # 添加文件头部注释
        lines.append("# AI Novelist 环境变量配置文件")
        lines.append("# 此文件由系统自动管理，请勿手动修改")
        lines.append("")
        
        # 按提供商分组写入
        provider_keys = {}
        other_keys = {}
        
        for key, value in env_vars.items():
            if key.startswith(ENV_PREFIX):
                provider_name = key[len(ENV_PREFIX):].lower().replace('_key', '')
                provider_keys[key] = value
            else:
                other_keys[key] = value
        
        # 写入提供商相关的 KEY
        if provider_keys:
            lines.append("# ========== 模型提供商 API KEYS ==========")
            lines.append("")
            
            for key, value in sorted(provider_keys.items()):
                # 添加注释
                if comments and key in comments:
                    lines.append(f"# {comments[key]}")
                
                formatted_value = format_env_value(value)
                lines.append(f"{key}={formatted_value}")
                lines.append("")
        
        # 写入其他环境变量
        if other_keys:
            lines.append("# ========== 其他环境变量 ==========")
            lines.append("")
            
            for key, value in sorted(other_keys.items()):
                if comments and key in comments:
                    lines.append(f"# {comments[key]}")
                
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


def get_provider_env_key(provider_id: str) -> str:
    """
    获取提供商对应的 .env 环境变量名
    
    Args:
        provider_id: 提供商 ID (如 'deepseek', 'openai')
    
    Returns:
        str: 环境变量名 (如 'AI_NOVELIST_DEEPSEEK_KEY')
    """
    provider_upper = provider_id.upper().replace('-', '_')
    return f"{ENV_PREFIX}{provider_upper}_KEY"


def get_api_key_from_env(provider_id: str) -> Optional[str]:
    """
    从环境变量或 .env 文件获取指定提供商的 API KEY
    
    Args:
        provider_id: 提供商 ID
    
    Returns:
        Optional[str]: API KEY 或 None
    """
    env_key = get_provider_env_key(provider_id)
    
    # 首先检查 os.environ
    if env_key in os.environ:
        return os.environ[env_key]
    
    # 尝试从 .env 文件加载
    env_vars = load_env_file()
    
    return env_vars.get(env_key)


def set_api_key_to_env(provider_id: str, api_key: str) -> bool:
    """
    设置指定提供商的 API KEY 到 .env 文件
    
    Args:
        provider_id: 提供商 ID
        api_key: API KEY
    
    Returns:
        bool: 设置成功返回 True
    """
    env_key = get_provider_env_key(provider_id)
    
    # 加载现有的环境变量
    env_vars = load_env_file()
    
    # 更新 API KEY
    env_vars[env_key] = api_key
    
    # 同时更新当前进程的环境变量
    os.environ[env_key] = api_key
    
    # 添加注释
    comments = {
        env_key: f"{provider_id} 提供商的 API Key"
    }
    
    # 保存到文件
    return save_env_file(env_vars, comments)


def remove_api_key_from_env(provider_id: str) -> bool:
    """
    从 .env 文件移除指定提供商的 API KEY
    
    Args:
        provider_id: 提供商 ID
    
    Returns:
        bool: 移除成功返回 True
    """
    env_key = get_provider_env_key(provider_id)
    
    # 加载现有的环境变量
    env_vars = load_env_file()
    
    # 如果存在则移除
    if env_key in env_vars:
        del env_vars[env_key]
        
        # 同时移除当前进程的环境变量
        if env_key in os.environ:
            del os.environ[env_key]
    
    # 保存到文件
    return save_env_file(env_vars)


def get_all_provider_keys() -> Dict[str, str]:
    """
    获取所有提供商的 API KEYS
    
    Returns:
        Dict[str, str]: {provider_id: api_key}
    """
    env_vars = load_env_file()
    provider_keys = {}
    
    for key, value in env_vars.items():
        if key.startswith(ENV_PREFIX) and key.endswith('_KEY'):
            # 从 AI_NOVELIST_PROVIDER_KEY 提取 provider_id
            provider_part = key[len(ENV_PREFIX):-4]  # 去掉前缀和后缀 _KEY
            provider_id = provider_part.lower().replace('_', '-')
            provider_keys[provider_id] = value
    
    return provider_keys


def initialize_env_file() -> None:
    """
    初始化 .env 文件
    如果文件不存在，创建一个空的模板文件
    """
    env_file = get_env_file_path()
    
    if not env_file.exists():
        logger.info(f"创建新的 .env 文件: {env_file}")
        save_env_file({})
