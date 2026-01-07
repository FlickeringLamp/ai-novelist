import json
import os
import time
import logging
from pathlib import Path
from typing import Dict, Any,TypedDict
from backend.core.ai_agent.prompts.sys_prompts import (
    OUTLINE_PROMPT,
    WRITING_PROMPT,
    ADJUSTMENT_PROMPT
)

logger = logging.getLogger(__name__)


def initialize_directories_and_files():
    """
    初始化backend/data下的所有目录和文件
    确保必要的目录存在，配置文件存在
    """
    base_dir = Path("backend/data")
    config_dir = base_dir / "config"
    novel_dir = base_dir / "novel"
    lancedb_dir = base_dir / "lancedb"
    db_dir = base_dir / "db"
    uploads_dir = base_dir / "uploads"
    temp_dir = base_dir / "temp"
    config_file = config_dir / "store.json"
    
    # 确保所有目录存在
    directories = [base_dir, config_dir, novel_dir, lancedb_dir, db_dir, uploads_dir, temp_dir]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    
    # 确保配置文件存在，不存在则创建包含默认值的配置文件
    if not config_file.exists():
        thread_id = f"thread_{int(time.time() * 1000)}"
        default_config = {
            "log_level": "INFO",
            "host": "127.0.0.1",
            "port": 8000,
            "selectedModel": "",
            "currentMode": "outline",
            "customPrompts": {
                "outline": OUTLINE_PROMPT,
                "writing": WRITING_PROMPT,
                "adjustment": ADJUSTMENT_PROMPT
            },
            "aiParameters": {
                "outline": {
                    "temperature": 0.7,
                    "top_p": 0.7,
                    "n": 1,
                    "max_tokens": 4096
                },
                "writing": {
                    "temperature": 0.7,
                    "top_p": 0.7,
                    "n": 1,
                    "max_tokens": 4096
                },
                "adjustment": {
                    "temperature": 0.7,
                    "top_p": 0.7,
                    "n": 1,
                    "max_tokens": 4096
                }
            },
            "mode_tools": {
                "outline": {
                    "enabled_tools": [],
                    "description": "自定义模式 - outline"
                },
                "writing": {
                    "enabled_tools": [],
                    "description": "自定义模式 - writing"
                },
                "adjustment": {
                    "enabled_tools": [],
                    "description": "自定义模式 - adjustment"
                }
            },
            "autoApproveSettings": {
                "enabled": False,
                "delay": 1000
            },
            "favoriteModels": {},
            "customProviders": [],
            "selectedProvider": "deepseek",
            "deepseek": {
                "url": "https://api.deepseek.com/v1",
                "key": ""
            },
            "aliyun": {
                "url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "key": ""
            },
            "siliconflow": {
                "url": "https://api.siliconflow.cn/v1",
                "key": ""
            },
            "openrouter": {
                "url": "https://openrouter.ai/api/v1",
                "key": ""
            },
            "kimi": {
                "url": "https://api.moonshot.cn/v1",
                "key": ""
            },
            "zhipuai": {
                "url": "https://open.bigmodel.cn/api/paas/v4/",
                "key": ""
            },
            "embeddingModels": {},
            "ragChunkSize": 150,
            "ragChunkOverlap": 20,
            "thread_id": thread_id,
            "additionalInfo": {
                "writing": {},
                "adjustment": {},
                "outline": {}
            }
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
        self.LOG_LEVEL: str = self.get_config("log_level", "INFO")
        self.HOST: str = self.get_config("host", "127.0.0.1")
        self.PORT: int = self.get_config("port", 8000)
        
        # 数据总目录
        base_dir = Path("backend/data")
        self.DATA_DIR: str = str(base_dir)
        
        # 配置文件目录
        self.config_file = Path("backend/data/config/store.json")
        self.CONFIG_DIR = str(self.config_file.parent)
        
        # 用户文件目录
        self.NOVEL_DIR: str = str(base_dir / "novel")
        # 向量数据库目录
        self.LANCEDB_PERSIST_DIR: str = str(base_dir / "lancedb")
        # SQLite数据库配置
        self.DB_DIR: str = str(base_dir / "db")
        self.CHECKPOINTS_DB_PATH: str = str(base_dir / "db" / "checkpoints.db")
        # 上传文件目录
        self.UPLOADS_DIR: str = str(base_dir / "uploads")
        # 临时文件目录
        self.TEMP_DIR: str = str(base_dir / "temp")
        
    def load_config(self) -> Dict[str, Any]:
        """从 store.json 加载配置"""
        try:
            with open(self._config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception):
            return {}    
    def get_config(self, key: str, default: Any = None) -> Any:
        """获取指定配置值"""
        config = self.load_config()
        value = config.get(key, default)
        return value
    
    def update_config(self, updates: Dict[str, Any]) -> bool:
        """批量更新配置"""
        try:
            # 读取现有配置
            with open(self._config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            # 批量更新配置
            config.update(updates)
            
            # 保存配置
            with open(self._config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            
            return True
        except Exception as e:
            logger.error(f"更新配置失败: {e}")
            return False

class State(TypedDict):
    """包含消息的状态"""
    messages: list

# 创建全局设置实例
settings = Settings()