import json
import os
import sys
import time
import logging
import sqlite3
from pathlib import Path
from typing import Dict, Any, TypedDict

import yaml

from backend.config.providers import PROVIDERS
from backend.config.mode import DEFAULT_MODES
from backend.config.env_manager import (
    get_api_key_from_env,
    set_api_key_to_env,
    remove_api_key_from_env,
    initialize_env_file,
    load_env_file
)

logger = logging.getLogger(__name__)

# 获取模型目录路径（支持开发环境和PyInstaller打包环境）
def get_model_dir():
    """获取模型目录路径（支持开发环境和PyInstaller打包环境）"""
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后的环境
        base_dir = os.path.dirname(sys.executable)
    else:
        # 开发环境 - 项目根目录（backend的父目录）
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    return os.path.join(base_dir, 'models', 'embedding')

# 获取数据目录路径（支持开发环境和PyInstaller打包环境）
def get_data_dir():
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后的环境
        return Path('data')
    else:
        # 开发环境
        return Path('backend/data')

# 获取bin目录路径（支持开发环境和PyInstaller打包环境）
def get_bin_dir():
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后的环境
        return Path('bin')
    else:
        # 开发环境
        return Path('bin')

def initialize_directories_and_files():
    """
    初始化data目录下的所有目录和文件
    确保必要的目录存在，配置文件存在
    """
    base_dir = get_data_dir()
    config_dir = base_dir / "config"
    chromadb_dir = base_dir / "chromadb"
    db_dir = base_dir / "db"
    uploads_dir = base_dir / "uploads"
    temp_dir = base_dir / "temp"
    skills_dir = base_dir / "skills"
    config_file = config_dir / "store.yaml"
    skills_config_file = config_dir / "skills_config.yaml"
    
    # 确保所有目录存在
    directories = [base_dir, config_dir, chromadb_dir, db_dir, uploads_dir, temp_dir, skills_dir]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    
    # 初始化 .env 文件
    initialize_env_file()
    
    # 确保配置文件存在，不存在则创建包含默认值的配置文件
    if not config_file.exists():
        thread_id = f"thread_{int(time.time() * 1000)}"
        default_config = {
            "log_level": "INFO",
            "host": "127.0.0.1",
            "port": 8000,
            "currentMode": "管家agent",
            "mode": DEFAULT_MODES,
            "autoApproveSettings": False,
            "selectedProvider": "",
            "selectedModel": "",
            "provider": PROVIDERS,
            "thread_id": thread_id,
            "knowledgeBase":{},
            "two-step-rag": None,
            "mcpServers": {}  # MCP服务器配置
        }
        _save_config(default_config, config_file)
        logger.info(f"创建配置文件: {config_file}")
    
    # 确保skills配置文件存在
    if not skills_config_file.exists():
        default_skills_config = {
            "baidu-search": {
                "name": "百度搜索",
                "description": "使用百度搜索API进行网络搜索",
                "env": {
                    "BAIDU_API_KEY": ""
                }
            }
        }
        _save_config(default_skills_config, skills_config_file)
        logger.info(f"创建skills配置文件: {skills_config_file}")
    
    # 初始化Git仓库和相关配置文件
    _initialize_git(base_dir)


def _initialize_git(base_dir: Path):
    """
    初始化Git仓库和相关配置文件
    
    Args:
        base_dir: data目录路径
    """
    try:
        import git
        from git import Repo, GitCommandError
        
        git_dir = base_dir / ".git"
        gitignore_path = base_dir / ".gitignore"
        aiignore_path = base_dir / ".aiignore"
        userignore_path = base_dir / ".userignore"
        
        # 如果Git仓库已存在，跳过初始化
        if git_dir.exists():
            logger.info("Git仓库已存在，跳过初始化")
            return
        
        logger.info(f"正在初始化Git仓库: {base_dir}")
        
        # 初始化Git仓库
        repo = Repo.init(base_dir)
        
        # 配置Git用户信息
        with repo.config_writer() as config:
            config.set_value("user", "name", "AI Novelist")
            config.set_value("user", "email", "noreply@ai-novelist.local")
            config.set_value("commit", "gpgSign", "false")
        
        # 创建ignore文件
        _create_ignore_file(gitignore_path, ["config/", "chromadb/", "db/", "uploads/", "temp/"], "gitignore")
        _create_ignore_file(aiignore_path, ["config/", "chromadb/", "db/", "uploads/", "temp/", "skills/"], "aiignore")
        _create_ignore_file(userignore_path, ["config/", "chromadb/", "db/", "uploads/", "temp/", "skills/"], "userignore")
        
        # 创建初始提交
        repo.index.add(["."])
        repo.index.commit(
            "Initial checkpoint",
            author_date=time.strftime("%Y-%m-%dT%H:%M:%S"),
            commit_date=time.strftime("%Y-%m-%dT%H:%M:%S"),
        )
        
        logger.info("Git仓库初始化成功")
        
    except ImportError:
        logger.warning("GitPython未安装，跳过Git仓库初始化")
    except GitCommandError as e:
        logger.error(f"Git仓库初始化失败: {e}")


def _create_ignore_file(file_path: Path, patterns: list, file_type: str):
    """创建ignore文件的通用函数
    
    Args:
        file_path: 文件路径
        patterns: 忽略模式列表
        file_type: 文件类型（用于日志）
    """
    if not file_path.exists():
        file_path.write_text("\n".join(patterns), encoding="utf-8")
        logger.info(f"创建.{file_type}: {file_path}")


def _load_config_file(file_path: Path) -> Dict[str, Any]:
    """加载 YAML 配置文件
    
    Args:
        file_path: 配置文件路径
    
    Returns:
        Dict[str, Any]: 配置字典
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        logger.error(f"加载配置文件失败 {file_path}: {e}")
        return {}


def _save_config(config: Dict[str, Any], file_path: Path) -> bool:
    """保存配置到 YAML 文件
    
    Args:
        config: 配置字典
        file_path: 文件路径
    
    Returns:
        bool: 保存成功返回 True
    """
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
        return True
    except Exception as e:
        logger.error(f"保存配置文件失败 {file_path}: {e}")
        return False


class Settings:
    """
    统一配置系统
    """
    
    def __init__(self):
        # 应用配置
        self.LOG_LEVEL: str = self.get_config("log_level", default="INFO")
        self.HOST: str = self.get_config("host", default="127.0.0.1")
        self.PORT: int = self.get_config("port", default=8000)
        
        # 数据总目录
        base_dir = get_data_dir()
        self.DATA_DIR: str = str(base_dir)
        
        # 配置文件目录
        self.CONFIG_DIR = str(base_dir / "config")
        
        # 向量数据库目录
        self.CHROMADB_PERSIST_DIR: str = str(base_dir / "chromadb")
        # SQLite数据库配置
        self.DB_DIR: str = str(base_dir / "db")
        self.CHECKPOINTS_DB_PATH: str = str(base_dir / "db" / "checkpoints.db")
        # 上传文件目录
        self.UPLOADS_DIR: str = str(base_dir / "uploads")
        # 临时文件目录
        self.TEMP_DIR: str = str(base_dir / "temp")
        # Skills目录
        self.SKILLS_DIR: str = str(base_dir / "skills")
        
        # UVX 可执行文件路径
        self.UVX_EXECUTABLE: str = self._get_executable('uvx.exe')
        # Node.js 可执行文件路径
        self.NODE_EXECUTABLE: str = self._get_executable('node.exe')
        # NPM 可执行文件路径
        self.NPM_EXECUTABLE: str = self._get_executable('npm.cmd')
        # Ripgrep 可执行文件路径
        self.RG_EXECUTABLE: str = self._get_executable('rg.exe')
    
    def _get_executable(self, exe_name: str) -> str:
        """获取项目自带的可执行文件路径，如果不存在则使用系统命令
        
        Args:
            exe_name: 可执行文件名（如 'uv.exe' 或 'node.exe'）
        
        Returns:
            str: 可执行文件的完整路径或系统命令名
        """
        bin_dir = get_bin_dir()
        exe_path = bin_dir / exe_name
        if exe_path.exists():
            logger.info(f"使用项目自带的 {exe_name}: {exe_path}")
            return str(exe_path)
        # 如果项目自带的不存在，回退到系统命令
        cmd_name = exe_name.replace('.exe', '')
        logger.info(f"使用系统 {cmd_name}")
        return cmd_name
        
    def _load_config(self, config_file: str = "store.yaml") -> Dict[str, Any]:
        """加载配置，每次都会创建全新的字典对象
        
        Args:
            config_file: 配置文件名，如 'store.yaml' 或 'skills_config.yaml'
        """
        try:
            config_path = Path(self.CONFIG_DIR) / config_file
            return _load_config_file(config_path)
        except Exception:
            return {}
    
    def get_provider_key(self, provider_id: str) -> str:
        """
        从 .env 文件获取提供商的 API KEY
        
        Args:
            provider_id: 提供商 ID (如 'deepseek', 'openai')
        
        Returns:
            str: API KEY，如果没有则返回空字符串
        """
        key = get_api_key_from_env(provider_id)
        return key if key else ""
    
    def set_provider_key(self, provider_id: str, api_key: str) -> bool:
        """
        设置提供商的 API KEY 到 .env 文件
        
        Args:
            provider_id: 提供商 ID
            api_key: API KEY
        
        Returns:
            bool: 设置成功返回 True
        """
        return set_api_key_to_env(provider_id, api_key)
    
    def remove_provider_key(self, provider_id: str) -> bool:
        """
        从 .env 文件移除提供商的 API KEY
        
        Args:
            provider_id: 提供商 ID
        
        Returns:
            bool: 移除成功返回 True
        """
        return remove_api_key_from_env(provider_id)
    
    def get_config(self, *keys: str, default: Any = None, config_file: str = "store.yaml") -> Any:
        """获取指定配置值，支持多层嵌套。返回临时字典的引用，必须使用update_config更新，才能保存到磁盘
        
        Args:
            *keys: 嵌套的键路径，如 get_config('level1', 'level2', 'level3')
            default: 默认值
            config_file: 配置文件名，如 'store.yaml' 或 'skills_config.yaml'
        """
        config = self._load_config(config_file)
        current = config
        
        try:
            # 遍历所有键
            for key in keys:
                current = current[key]
            return current
        except (KeyError, TypeError):
            return default
    
    def update_config(self, value: Any, *keys: str, config_file: str = "store.yaml") -> bool:
        """更新配置，支持多层嵌套
        
        Args:
            value: 要设置的值
            *keys: 嵌套的键路径，如 update_config(new_value, 'level1', 'level2', 'level3')
            config_file: 配置文件名，如 'store.yaml' 或 'skills_config.yaml'
        """
        try:
            config = self._load_config(config_file)
            current = config
            
            # 遍历到最后一层的前一个
            for key in keys[:-1]:
                if key not in current:
                    current[key] = {}
                current = current[key]
                
            # 设置最后一层的值
            current[keys[-1]] = value
            
            # 保存配置
            config_path = Path(self.CONFIG_DIR) / config_file
            return _save_config(config, config_path)
        except (KeyError, TypeError, IndexError) as e:
            logger.error(f"更新配置失败: {e}")
            return False
    
    def delete_config(self, *keys: str, config_file: str = "store.yaml") -> bool:
        """删除配置，支持多层嵌套
        
        Args:
            *keys: 嵌套的键路径，如 delete_config('level1', 'level2', 'level3')
            config_file: 配置文件名，如 'store.yaml' 或 'skills_config.yaml'
        
        Returns:
            bool: 删除成功返回True，失败返回False
        """
        try:
            config = self._load_config(config_file)
            current = config
            
            # 遍历到最后一层的前一个
            for key in keys[:-1]:
                if key not in current:
                    return False
                current = current[key]
            
            # 删除最后一层的键
            if keys[-1] in current:
                del current[keys[-1]]
                
                # 保存配置
                config_path = Path(self.CONFIG_DIR) / config_file
                return _save_config(config, config_path)
            return False
        except (KeyError, TypeError, IndexError) as e:
            logger.error(f"删除配置失败: {e}")
            return False

class State(TypedDict):
    """包含消息的状态"""
    messages: list

# 创建全局设置实例
settings = Settings()

def get_db_connection():
    """获取数据库连接，用于直接查询数据库（如 history_api.py）
    
    """
    conn = sqlite3.connect(settings.CHECKPOINTS_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # 返回字典格式
    return conn
