import json
import os
import sys
import time
import logging
import sqlite3
from pathlib import Path
from typing import Dict, Any, TypedDict
from backend.config.providers import PROVIDERS
from backend.config.mode import DEFAULT_MODES

logger = logging.getLogger(__name__)

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
    novel_dir = base_dir / "novel"
    chromadb_dir = base_dir / "chromadb"
    db_dir = base_dir / "db"
    uploads_dir = base_dir / "uploads"
    temp_dir = base_dir / "temp"
    mcp_servers_dir = base_dir / "mcp_servers"
    config_file = config_dir / "store.json"
    
    # 确保所有目录存在
    directories = [base_dir, config_dir, novel_dir, chromadb_dir, db_dir, uploads_dir, temp_dir, mcp_servers_dir]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    
    # 确保配置文件存在，不存在则创建包含默认值的配置文件
    if not config_file.exists():
        thread_id = f"thread_{int(time.time() * 1000)}"
        default_config = {
            "log_level": "INFO",
            "host": "127.0.0.1",
            "port": 8000,
            "currentMode": "outline",
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
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, ensure_ascii=False, indent=2)
        logger.info(f"创建配置文件: {config_file}")


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
        self.config_file = base_dir / "config" / "store.json"
        self.CONFIG_DIR = str(self.config_file.parent)
        
        # 用户文件目录
        self.NOVEL_DIR: str = str(base_dir / "novel")
        # 向量数据库目录
        self.CHROMADB_PERSIST_DIR: str = str(base_dir / "chromadb")
        # SQLite数据库配置
        self.DB_DIR: str = str(base_dir / "db")
        self.CHECKPOINTS_DB_PATH: str = str(base_dir / "db" / "checkpoints.db")
        # 上传文件目录
        self.UPLOADS_DIR: str = str(base_dir / "uploads")
        # 临时文件目录
        self.TEMP_DIR: str = str(base_dir / "temp")
        # MCP服务器目录
        self.MCP_SERVERS_DIR: str = str(base_dir / "mcp_servers")
        
        # UVX 可执行文件路径
        self.UVX_EXECUTABLE: str = self._get_executable('uvx.exe')
        # Node.js 可执行文件路径
        self.NODE_EXECUTABLE: str = self._get_executable('node.exe')
        # NPM 可执行文件路径
        self.NPM_EXECUTABLE: str = self._get_executable('npm.cmd')
    
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
        
    def _load_config(self) -> Dict[str, Any]:
        """从 store.json 加载配置，每次都会创建全新的字典对象"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception):
            return {}
    def get_config(self, *keys: str, default: Any = None) -> Any:
        """获取指定配置值，支持多层嵌套。返回临时字典的引用，必须使用update_config更新，才能保存到磁盘
        
        Args:
            *keys: 嵌套的键路径，如 get_config('level1', 'level2', 'level3')
            default: 默认值
        """
        config = self._load_config()
        current = config
        
        try:
            # 遍历所有键
            for key in keys:
                current = current[key]
            return current
        except (KeyError, TypeError):
            return default
    
    def update_config(self, value: Any, *keys: str) -> bool:
        """更新配置，支持多层嵌套
        
        Args:
            value: 要设置的值
            *keys: 嵌套的键路径，如 update_config(new_value, 'level1', 'level2', 'level3')
        """
        try:
            config = self._load_config()
            current = config
            
            # 遍历到最后一层的前一个
            for key in keys[:-1]:
                if key not in current:
                    current[key] = {}
                current = current[key]
                
            # 设置最后一层的值
            current[keys[-1]] = value
            
            # 保存配置
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            return True
        except (KeyError, TypeError, IndexError) as e:
            logger.error(f"更新配置失败: {e}")
            return False
    
    def delete_config(self, *keys: str) -> bool:
        """删除配置，支持多层嵌套
        
        Args:
            *keys: 嵌套的键路径，如 delete_config('level1', 'level2', 'level3')
        
        Returns:
            bool: 删除成功返回True，失败返回False
        """
        try:
            config = self._load_config()
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
                with open(self.config_file, 'w', encoding='utf-8') as f:
                    json.dump(config, f, ensure_ascii=False, indent=2)
                return True
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
