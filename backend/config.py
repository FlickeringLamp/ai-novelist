import json
import os
import time
import logging
from pathlib import Path
from typing import Dict, Any, TypedDict
from backend.core.ai_agent.models.providers import PROVIDERS

logger = logging.getLogger(__name__)


# 所有可用的工具列表
ALL_AVAILABLE_TOOLS = [
    "read_file",
    "write_file",
    "search_file",
    "apply_diff",
    "search_and_replace",
    "insert_content",
    "ask_user_question",
    "emb_search"
]

# "细纲模式"的提示词
OUTLINE_PROMPT = """你是一位小说创作顾问，负责与用户深度沟通本章核心需求。
先通过多轮对话收集以下信息：
1. 核心情节冲突。
2. 人物行为与动机。
3. 场景与氛围要求。
4. 本章需要注意的伏笔或者暗线。
5. 后一章的大致走向，便于本章结尾的铺垫。

随后生成完整的结构化细纲（含场景序列、关键对话、情绪转折点等等），向用户展示细纲并询问：『是否需调整？请指出修改方向』。

注意，请保持和用户沟通时的礼貌。"""

# "写作模式"的提示词
WRITING_PROMPT = """你是一位专业小说代笔，需严格基于用户提供的【最终版细纲】进行创作。核心任务：解析细纲中的场景节点，扩展为2000字左右的正文。文风模仿知识库中的句式结构、高频词汇、描写偏好。重点在于补充各种描写，非必要时禁止添加细纲外新情节。"""

# "调整模式"的提示词
ADJUSTMENT_PROMPT = """你是一位资深编辑和小说精修师。你的任务是：
1.  **诊断问题**：根据用户提供的草稿，从剧情逻辑、语言问题（如"AI味"）、风格一致性等方面进行检查。
2.  **提供报告**：输出一份检查报告，每个问题都需提供修改案例，格式为：【原句】、【建议】、【理由】。
3.  **执行修改**：根据用户批准的修改建议，对草稿进行精修，确保修改后的内容逻辑清晰、文风与原文保持一致，并且不得变更用户已确认的核心情节。"""


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
            "mode": {
                "outline": {
                    "prompt": OUTLINE_PROMPT,
                    "temperature": 0.7,
                    "top_p": 0.7,
                    "max_tokens": 4096,
                    "additionalInfo": [],
                    "tools": ["read_file", "write_file", "ask_user_question"]
                },
                "writing": {
                    "prompt": WRITING_PROMPT,
                    "temperature": 0.7,
                    "top_p": 0.7,
                    "max_tokens": 4096,
                    "additionalInfo": [],
                    "tools": ["read_file", "write_file", "ask_user_question"]
                },
                "adjustment": {
                    "prompt": ADJUSTMENT_PROMPT,
                    "temperature": 0.7,
                    "top_p": 0.7,
                    "max_tokens": 4096,
                    "additionalInfo": [],
                    "tools": ["read_file", "write_file", "ask_user_question"]
                }
            },
            "autoApproveSettings": {
                "enabled": False,
                "delay": 1000
            },
            "selectedProvider": "deepseek",
            "provider": PROVIDERS,
            "embeddingModels": {},
            "ragChunkSize": 150,
            "ragChunkOverlap": 20,
            "thread_id": thread_id
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
        
    def _load_config(self) -> Dict[str, Any]:
        """从 store.json 加载配置"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception):
            return {}
    def get_config(self, *keys: str, default: Any = None) -> Any:
        """获取指定配置值，支持多层嵌套
        
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
