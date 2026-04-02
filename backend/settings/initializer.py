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


def _initialize_git(base_dir: Path):
    """初始化Git仓库和相关配置文件"""
    try:
        
        git_dir = base_dir / ".git"
        
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
        
        # 第一步：创建完全空的初始提交（使用 git commit --allow-empty）
        repo.git.commit(
            "--allow-empty",
            "-m", "Initial commit (empty)",
            "--date", time.strftime("%Y-%m-%dT%H:%M:%S"),
        )
        logger.info("创建空初始提交")
        
        # 第二步：添加所有文件并提交（这是第一个有意义的存档点，有父提交可对比）
        # 使用 git add -A 来遵守 .gitignore 规则
        repo.git.add("-A")
        repo.index.commit(
            "Initial checkpoint",
            author_date=time.strftime("%Y-%m-%dT%H:%M:%S"),
            commit_date=time.strftime("%Y-%m-%dT%H:%M:%S"),
        )
        logger.info("创建初始存档点")
        
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
    
    # 确保 .env 文件存在，不存在则创建空文件
    if not env_file.exists():
        env_file.write_text("", encoding='utf-8')
        logger.info(f"创建 .env 文件: {env_file}")
    
    # 初始化Git仓库和相关配置文件
    _initialize_git(base_dir)
