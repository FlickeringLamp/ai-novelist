"""
Google Gemini官方API适配器
使用google.generativeai库直接调用Gemini API
"""

import json
import logging
from typing import List, Dict, Any, AsyncGenerator, Optional
from google import genai
from ai_agent.config import ai_settings

logger = logging.getLogger(__name__)


class GeminiOfficialAdapter:
    """
    Google Gemini 官方API适配器
    使用google.generativeai库直接调用Gemini API
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Gemini 官方适配器构造函数

        Args:
            api_key: Gemini API密钥，如果为None则从配置中获取
        """
        self.api_key = api_key or ai_settings.GEMINI_API_KEY
        self.client = None  # 延迟初始化
        
        # Gemini 支持的模型列表
        self.supported_models = [
            {
                "id": "gemini-2.5-flash",
                "name": "Gemini 2.5 Flash",
                "description": "Google Gemini 2.5 Flash 模型，快速且高效",
                "max_tokens": 1000000,
                "context_window": 1000000,
                "supports_multimodal": True,
                "supports_tool_calling": True,
                "supports_structured_output": True,
                "supports_reasoning": True
            },
            {
                "id": "gemini-2.0-flash",
                "name": "Gemini 2.0 Flash",
                "description": "Google Gemini 2.0 Flash 模型",
                "max_tokens": 1000000,
                "context_window": 1000000,
                "supports_multimodal": True,
                "supports_tool_calling": True,
                "supports_structured_output": True
            },
            {
                "id": "gemini-1.5-flash",
                "name": "Gemini 1.5 Flash",
                "description": "Google Gemini 1.5 Flash 模型",
                "max_tokens": 1000000,
                "context_window": 1000000,
                "supports_multimodal": True,
                "supports_tool_calling": True,
                "supports_structured_output": True
            },
            {
                "id": "gemini-1.5-pro",
                "name": "Gemini 1.5 Pro",
                "description": "Google Gemini 1.5 Pro 模型，功能更强大",
                "max_tokens": 2000000,
                "context_window": 2000000,
                "supports_multimodal": True,
                "supports_tool_calling": True,
                "supports_structured_output": True
            },
            {
                "id": "gemini-1.0-pro",
                "name": "Gemini 1.0 Pro",
                "description": "Google Gemini 1.0 Pro 模型",
                "max_tokens": 30720,
                "context_window": 30720,
                "supports_multimodal": False,
                "supports_tool_calling": True,
                "supports_structured_output": True
            }
        ]

    def _get_client(self) -> genai.Client:
        """
        获取Gemini客户端（延迟初始化）

        Returns:
            Gemini客户端实例
        """
        if not self.client:
            if not self.api_key:
                logger.warning("Gemini API key is not set. Please configure it in the settings.")
                return None

            self.client = genai.Client(api_key=self.api_key)

        return self.client

    def _convert_messages_to_content(self, messages: List[Dict[str, Any]]) -> str:
        """
        将标准消息格式转换为Gemini API的内容格式

        Args:
            messages: 标准消息列表

        Returns:
            Gemini API的内容字符串
        """
        content_parts = []
        
        for message in messages:
            role = message.get("role", "")
            content = message.get("content", "")
            
            if role == "system":
                # 系统消息作为对话的开始
                content_parts.append(f"系统: {content}")
            elif role == "user":
                content_parts.append(f"用户: {content}")
            elif role == "assistant":
                content_parts.append(f"助手: {content}")
            else:
                content_parts.append(f"{role}: {content}")
        
        return "\n".join(content_parts)

    async def generate_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str = "gemini-2.5-flash",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        生成AI完成响应

        Args:
            messages: 聊天消息数组
            model: 模型ID
            temperature: 温度参数
            max_tokens: 最大token数
            **kwargs: 其他参数

        Returns:
            统一格式的AI响应异步迭代器
        """
        try:
            client = self._get_client()
            if not client:
                logger.error("[GeminiOfficialAdapter] 客户端未初始化，API密钥可能未配置")
                yield {"type": "error", "text": "Gemini API key not configured"}
                return

            # 将消息转换为Gemini API的内容格式
            content = self._convert_messages_to_content(messages)

            logger.info(f"[GeminiOfficialAdapter] Sending request - model: {model}, content length: {len(content)}")

            # 调用Gemini API - 使用正确的参数格式
            response = client.models.generate_content(
                model=model,
                contents=content
            )

            # 返回响应
            if response.text:
                yield {
                    "type": "text",
                    "content": response.text
                }
            else:
                yield {
                    "type": "error",
                    "text": "Gemini API返回了空响应"
                }

            # 返回处理完成标记
            yield {
                "type": "processed",
                "payload": "AI响应已处理"
            }

        except Exception as error:
            logger.error(f"[GeminiOfficialAdapter] API调用失败: {error}")
            yield {"type": "error", "text": f"Gemini API调用失败: {str(error)}"}

    async def list_models(self) -> List[Dict[str, Any]]:
        """
        列出提供商支持的所有模型

        Returns:
            模型信息列表
        """
        try:
            client = self._get_client()
            if client:
                # 尝试从API获取可用模型
                import asyncio
                try:
                    # 注意：官方API可能没有直接的模型列表接口
                    # 这里我们返回预定义模型列表
                    return self.supported_models
                except Exception as api_error:
                    logger.warning(f"无法从Gemini API获取模型列表: {api_error}")
        except Exception as error:
            logger.warning(f"无法从Gemini API获取模型列表，使用预定义列表: {error}")

        # 如果API调用失败，返回预定义模型列表
        return self.supported_models

    async def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """
        获取特定模型的详细信息

        Args:
            model_id: 模型ID

        Returns:
            模型详细信息
        """
        model = next((m for m in self.supported_models if m["id"] == model_id), None)
        if not model:
            raise ValueError(f"模型 '{model_id}' 不存在于 GeminiOfficialAdapter 中")
        return model

    async def is_available(self) -> bool:
        """
        检查适配器是否可用

        Returns:
            是否可用
        """
        try:
            if not self.api_key:
                return False
            
            # 尝试简单的API调用来测试连接
            client = self._get_client()
            if not client:
                return False
                
            # 测试调用
            test_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents="Hello"
            )
            return test_response.text is not None
            
        except Exception as error:
            logger.warning(f"Gemini官方适配器不可用: {error}")
            return False

    def update_config(self, api_key: Optional[str] = None):
        """
        更新配置

        Args:
            api_key: 新的API密钥
        """
        if api_key:
            self.api_key = api_key
            self.client = None  # 重置客户端以应用新配置


# 创建全局适配器实例
gemini_official_adapter = GeminiOfficialAdapter()