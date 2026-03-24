import os
import time
import logging
from pathlib import Path
from typing import Dict, Any
import git
from git import Repo, GitCommandError

import yaml

from backend.settings.settings import settings

logger = logging.getLogger(__name__)


def _save_config(config: Dict[str, Any], file_path: Path) -> bool:
    """保存配置到 YAML 文件"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
        return True
    except Exception as e:
        logger.error(f"保存配置文件失败 {file_path}: {e}")
        return False


def _create_ignore_file(file_path: Path, patterns: list, file_type: str):
    """创建ignore文件的通用函数"""
    if not file_path.exists():
        file_path.write_text("\n".join(patterns), encoding="utf-8")
        logger.info(f"创建.{file_type}: {file_path}")


def _initialize_git(base_dir: Path):
    """初始化Git仓库和相关配置文件"""
    try:
        
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
    except Exception as e:
        logger.error(f"Git仓库初始化失败: {e}")


def initialize_directories_and_files():
    """
    初始化data目录下的所有目录和文件
    确保必要的目录存在（配置文件已随项目分发，不再自动创建）
    """
    # 从 settings 获取路径属性
    base_dir = Path(settings.DATA_DIR)
    config_dir = Path(settings.CONFIG_DIR)
    chromadb_dir = Path(settings.CHROMADB_PERSIST_DIR)
    db_dir = Path(settings.DB_DIR)
    uploads_dir = Path(settings.UPLOADS_DIR)
    temp_dir = Path(settings.TEMP_DIR)
    skills_dir = Path(settings.SKILLS_DIR)
    env_file = settings.ENV_FILE_PATH
    
    # 确保所有目录存在
    directories = [base_dir, config_dir, chromadb_dir, db_dir, uploads_dir, temp_dir, skills_dir, env_file.parent]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    
    # 确保 .env 文件存在，不存在则创建并填入提供商环境变量 key
    if not env_file.exists():
        env_lines = []
        for env_key in settings.PROVIDER_ENV_KEYS.values():
            env_lines.append(f"{env_key}=")
        env_file.write_text("\n".join(env_lines), encoding='utf-8')
        logger.info(f"创建 .env 文件: {env_file}")
    
    # 初始化Git仓库和相关配置文件
    _initialize_git(base_dir)
