import json
import os
import time
import logging
from pathlib import Path
from typing import Optional, Dict, Any, TypedDict

from backend.core.ai_agent.prompts import sys_prompts

logger = logging.getLogger(__name__)


class Settings:
    """
    统一配置系统 - 所有配置都从 store.json 读取
    """
    
    def __init__(self):
        self._config_file = Path("backend/data/config/store.json")
        
        # 应用配置
        self.APP_NAME: str = "AI Novelist Backend"
        self.DEBUG: bool = self._get_config("debug", True)
        self.HOST: str = self._get_config("host", "127.0.0.1")
        self.PORT: int = self._get_config("port", 8000)
        
        # 数据目录
        base_dir = Path("backend")
        self.DATA_DIR: str = str(base_dir / "data")
        self.NOVEL_DIR: str = str(base_dir / "data" / "novel")
        
        # 向量数据库配置 (使用LanceDB)
        self.LANCEDB_PERSIST_DIR: str = str(base_dir / "data" / "lancedb")
        
        # SQLite数据库配置
        self.DB_DIR: str = str(base_dir / "data" / "db")
        self.CHECKPOINTS_DB_PATH: str = str(base_dir / "data" / "db" / "checkpoints.db")
        
        # 文件配置
        self.MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
        self.ALLOWED_EXTENSIONS: str = ".txt,.md,.pdf,.docx"
        
        # 确保必要的目录存在
        os.makedirs(self.DATA_DIR, exist_ok=True)
        os.makedirs(self.NOVEL_DIR, exist_ok=True)
        os.makedirs(self.LANCEDB_PERSIST_DIR, exist_ok=True)
        os.makedirs(self.DB_DIR, exist_ok=True)
    
    @staticmethod
    def get_config_file_path() -> Path:
        """获取配置文件路径"""
        return Path("backend/data/config/store.json")
    
    def _load_config(self) -> Dict[str, Any]:
        """从 store.json 加载配置"""
        if not self._config_file.exists():
            return {}
        
        try:
            with open(self._config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception):
            return {}
    
    def _get_config(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        # 每次获取配置时重新加载，确保获取最新配置
        config = self._load_config()
        value = config.get(key, default)
        
        # 处理嵌套的配置结构（兼容前端可能发送的嵌套结构）
        if isinstance(value, dict):
            # 如果值是字典，尝试提取实际的配置值
            if 'value' in value:
                return value['value']
            elif 'success' in value and 'value' in value:
                return value['value']
        
        return value
    
    def reload(self):
        """重新加载配置（向后兼容）"""
        pass  # 现在每次访问都会重新加载，这个方法保留用于向后兼容


class AISettings:
    """
    AI Agent 配置系统 - 从 store.json 读取AI相关配置
    """
    
    def __init__(self):
        # 从config目录找到store.json
        self._config_file = Settings.get_config_file_path()
        
        # AI模型配置,超时暂时调大一点
        self.model: str = "deepseek-chat"
        self.temperature: float = 0.7
        self.max_tokens: int = 4096
        self.timeout: int = 300

    # 获取配置的方法
    def get_config(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        if not self._config_file.exists():
            # 如果配置文件不存在，创建默认配置文件
            try:
                self._config_file.parent.mkdir(parents=True, exist_ok=True)
                with open(self._config_file, 'w', encoding='utf-8') as f:
                    json.dump({}, f, ensure_ascii=False, indent=2)
                return default
            except Exception as e:
                logger.error(f"创建配置文件失败: {e}")
                return default
        
        try:
            with open(self._config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return config.get(key, default)
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"读取配置文件失败: {e}")
            return default

    # 获取所有配置
    def get_all_config(self) -> Dict[str, Any]:
        """获取所有配置"""
        if not self._config_file.exists():
            # 如果配置文件不存在，创建默认配置文件
            try:
                self._config_file.parent.mkdir(parents=True, exist_ok=True)
                with open(self._config_file, 'w', encoding='utf-8') as f:
                    json.dump({}, f, ensure_ascii=False, indent=2)
                return {}
            except Exception as e:
                logger.error(f"创建配置文件失败: {e}")
                return {}
        
        try:
            with open(self._config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"读取配置文件失败: {e}")
            return {}
    
    # 获取api_key配置
    def get_api_key_for_provider(self, provider: str) -> Optional[str]:
        """根据提供商获取对应的API密钥"""
        if provider == "ollama":
            return ""
        # 内置提供商的配置键映射
        provider_config_keys = {
            "deepseek": "deepseekApiKey",
            "openrouter": "openrouterApiKey",
            "aliyun": "aliyunApiKey",
            "siliconflow": "siliconflowApiKey",
            "zhipuai": "zhipuaiApiKey",
            "kimi": "kimiApiKey",
        }
        
        # 如果是内置提供商，直接获取配置
        if provider in provider_config_keys:
            api_key = self.get_config(provider_config_keys[provider])
            return api_key
        
        # 检查自定义提供商
        custom_providers = self.get_config("customProviders", [])
        for custom_provider in custom_providers:
            if custom_provider.get("name") == provider:
                return custom_provider.get("apiKey")
        
        return None
    
    
    def get_base_url_for_provider(self, provider: str) -> Optional[str]:
        """根据提供商获取对应的base_url"""
        # 先检查内置提供商
        from backend.core.ai_agent import BUILTIN_PROVIDERS
        
        if provider in BUILTIN_PROVIDERS:
            return BUILTIN_PROVIDERS[provider]
        
        # 检查自定义提供商
        custom_providers = self.get_config("customProviders", [])
        for custom_provider in custom_providers:
            if custom_provider.get("name") == provider:
                return custom_provider.get("baseUrl")
        
        # 其他提供商使用默认base_url
        return None
    
    @property
    def default_model(self) -> str:
        """默认模型（动态加载）"""
        return self.get_config("selectedModel", "deepseek-chat")
    
    @property
    def current_mode(self) -> str:
        """当前模式（动态加载）"""
        return self.get_config("currentMode", "outline")
    
    def get_prompt_for_mode(self, mode: str = None) -> str:
        """获取指定模式的提示词"""
        if mode is None:
            mode = self.current_mode
        
        custom_prompts = self.get_config("customPrompts", {})
        custom_prompt = custom_prompts.get(mode, "")
        
        # 如果自定义提示词为空，返回默认提示词
        if custom_prompt:
            return custom_prompt
        
        # 根据模式返回对应的默认提示词
        default_prompts = {
            "outline": sys_prompts.OUTLINE_PROMPT,
            "writing": sys_prompts.WRITING_PROMPT,
            "adjustment": sys_prompts.ADJUSTMENT_PROMPT
        }
        
        # 返回对应模式的默认提示词，如果模式不存在则返回大纲提示词
        return default_prompts.get(mode, sys_prompts.OUTLINE_PROMPT)
    
    def get_max_tokens_for_mode(self, mode: str = None) -> int:
        """获取指定模式的最大token数"""
        if mode is None:
            mode = self.current_mode
        
        # 获取模式特定的AI参数配置
        ai_parameters = self.get_config("aiParameters", {})
        mode_params = ai_parameters.get(mode, {})
        
        # 如果模式有特定的max_tokens配置，使用它
        if "max_tokens" in mode_params:
            return mode_params["max_tokens"]
        
        # 否则使用全局默认值
        return self.max_tokens
    
    def save_config(self, key: str, value: Any) -> bool:
        """保存配置值"""
        try:
            # 确保配置文件存在
            if not self._config_file.exists():
                self._config_file.parent.mkdir(parents=True, exist_ok=True)
                with open(self._config_file, 'w', encoding='utf-8') as f:
                    json.dump({}, f, ensure_ascii=False, indent=2)
            
            # 读取现有配置
            with open(self._config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            # 更新配置
            config[key] = value
            
            # 保存配置
            with open(self._config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            
            return True
        except Exception as e:
            logger.error(f"保存配置失败: {e}")
            return False
    
    def update_config(self, updates: Dict[str, Any]) -> bool:
        """批量更新配置"""
        try:
            # 确保配置文件存在
            if not self._config_file.exists():
                self._config_file.parent.mkdir(parents=True, exist_ok=True)
                with open(self._config_file, 'w', encoding='utf-8') as f:
                    json.dump({}, f, ensure_ascii=False, indent=2)
            
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
    
    def get_thread_id(self) -> str:
        """获取thread_id，如果不存在则创建一个新的"""
        thread_id = self.get_config("thread_id")
        if not thread_id:
            # 创建基于时间戳的新thread_id
            thread_id = f"thread_{int(time.time() * 1000)}"
            self.save_config("thread_id", thread_id)
            logger.info(f"创建新的thread_id: {thread_id}")
        return thread_id


# 定义状态类型，移除 add_messages 注解，手动管理，以便适应上下文压缩等需求
class State(TypedDict):
    """包含消息的状态"""
    messages: list


# 创建全局设置实例
settings = Settings()
ai_settings = AISettings()
