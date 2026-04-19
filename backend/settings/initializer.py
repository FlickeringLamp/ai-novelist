import os
import time
import logging
from pathlib import Path
from git import Repo

from backend.settings.settings import settings

logger = logging.getLogger(__name__)


def _ensure_data_subdirs(data_dir: Path):
    """检查并创建 data 下所有一级文件夹"""
    expected_dirs = [
        "config",
        "chromadb",
        "db",
        "uploads",
        "temp",
        "skills",
    ]
    for name in expected_dirs:
        subdir = data_dir / name
        if not subdir.exists():
            os.makedirs(subdir, exist_ok=True)
            logger.info(f"创建数据目录: {subdir}")


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
    1. 确保 data 下所有一级目录存在
    2. 确保 .env 文件存在
    3. 初始化 Git 仓库
    """
    data_dir = Path(settings.DATA_DIR)
    chromadb_dir = Path(settings.CHROMADB_PERSIST_DIR)
    db_dir = Path(settings.DB_DIR)
    uploads_dir = Path(settings.UPLOADS_DIR)
    temp_dir = Path(settings.TEMP_DIR)
    skills_dir = Path(settings.SKILLS_DIR)
    env_file = settings.ENV_FILE_PATH
    
    # 1. 确保 data 下所有一级目录存在
    _ensure_data_subdirs(data_dir)
    
    # 2. 确保其他必要的目录存在（env 文件的父目录等）
    directories = [chromadb_dir, db_dir, uploads_dir, temp_dir, skills_dir, env_file.parent]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    
    # 3. 确保 .env 文件存在，不存在则创建空文件
    if not env_file.exists():
        env_file.write_text("", encoding='utf-8')
        logger.info(f"创建 .env 文件: {env_file}")
    
    # 4. 初始化Git仓库和相关配置文件
    _initialize_git(data_dir)
