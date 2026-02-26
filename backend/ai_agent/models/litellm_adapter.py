from typing import Optional, List, Any, Dict, AsyncIterator
from langchain_core.messages import BaseMessage, AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.outputs import ChatResult, ChatGeneration, ChatGenerationChunk
from langchain_core.tools import BaseTool
from pydantic import Field, model_validator
from litellm import acompletion, completion
import json
import logging

logger = logging.getLogger(__name__)


class LiteLLMAdapter(BaseChatModel):
    """
    基于LiteLLM的模型适配器
    使用统一的接口调用各种大模型
    """
    model: str = Field(default="deepseek-chat")
    temperature: float = Field(default=0.7)
    max_tokens: int = Field(default=4096)
    timeout: int = Field(default=30)
    api_key: Optional[str] = Field(default=None)
    base_url: Optional[str] = Field(default=None)
    tools: Optional[List[BaseTool]] = Field(default=None)
    
    @model_validator(mode='after')
    def validate_config(self):
        """验证配置"""
        if not self.model:
            raise ValueError("model参数不能为空")
        return self
    
    def _format_messages(self, messages: List[BaseMessage]) -> List[Dict[str, Any]]:
        """
        将LangChain消息格式转换为LiteLLM格式
        """
        formatted = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                formatted.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                formatted.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                assistant_msg = {"role": "assistant", "content": msg.content or ""}
                
                # 处理reasoning_content（思维链内容）
                reasoning_content = None
                if hasattr(msg, 'additional_kwargs') and isinstance(msg.additional_kwargs, dict):
                    reasoning_content = msg.additional_kwargs.get('reasoning_content')
                
                # 如果有tool_calls，添加到消息中
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    tool_calls = []
                    for tool_call in msg.tool_calls:
                        tool_calls.append({
                            "id": tool_call["id"],
                            "type": "function",
                            "function": {
                                "name": tool_call["name"],
                                "arguments": json.dumps(tool_call["args"])
                            }
                        })
                    assistant_msg["tool_calls"] = tool_calls
                    
                    # Kimi API要求：当thinking启用且有tool_calls时，必须提供reasoning_content
                    # 优先使用收集到的reasoning_content，如果没有则使用空字符串
                    if reasoning_content is not None:
                        assistant_msg["reasoning_content"] = reasoning_content
                    elif not assistant_msg.get("content"):
                        assistant_msg["reasoning_content"] = ""
                
                formatted.append(assistant_msg)
            elif isinstance(msg, ToolMessage):
                formatted.append({"role": "tool", "content": msg.content, "tool_call_id": msg.tool_call_id})
        return formatted
    
    def _convert_tools_to_openai_format(self, tools: Optional[List[BaseTool]]) -> Optional[List[Dict[str, Any]]]:
        """
        将LangChain工具转换为OpenAI API格式
        """
        if not tools:
            return None
        
        openai_tools = []
        for tool in tools:
            # 如果是LangChain工具对象，转换为OpenAI格式
            # name: 自动从函数名获取
            # description: 自动从函数的 docstring 获取
            # parameters: 通过 args_schema 参数传入的 Pydantic BaseModel，调用其 model_json_schema() 方法生成 JSON Schema
            # 或者直接使用字典（如 MCP 工具）
            if isinstance(tool, BaseTool):
                # 处理 args_schema 可能是 Pydantic BaseModel 或 dict 的情况
                if tool.args_schema:
                    if isinstance(tool.args_schema, dict):
                        # MCP 工具的 args_schema 已经是 JSON Schema 格式的字典
                        parameters = tool.args_schema
                    else:
                        # Pydantic BaseModel，调用 model_json_schema() 生成 JSON Schema
                        parameters = tool.args_schema.model_json_schema()
                else:
                    parameters = {"type": "object", "properties": {}}
                
                tool_schema = {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": parameters
                    }
                }
                openai_tools.append(tool_schema)
        print("openai_tools:",openai_tools)
        return openai_tools

    # 虽然用不到，但是BaseChatModel必须包含一个_generate方法
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """
        生成响应（非流式）
        """
        # 转换消息格式
        formatted_messages = self._format_messages(messages)
        
        # 获取tools参数
        tools = kwargs.get("tools", self.tools)
        tools = self._convert_tools_to_openai_format(tools)
        
        # 构建调用参数
        call_kwargs = {
            "model": self.model,
            "messages": formatted_messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "timeout": self.timeout,
        }
        
        # 添加可选参数
        if self.api_key:
            call_kwargs["api_key"] = self.api_key
        if self.base_url:
            call_kwargs["base_url"] = self.base_url
        if tools:
            call_kwargs["tools"] = tools
        if stop:
            call_kwargs["stop"] = stop
        
        # 调用LiteLLM
        try:
            response = completion(**call_kwargs)
        except Exception as e:
            logger.error(f"LiteLLM调用失败: {e}")
            raise e
        
        # 解析响应
        choice = response.choices[0]
        message = choice.message
        
        # 提取工具调用
        tool_calls = None
        if hasattr(message, 'tool_calls') and message.tool_calls:
            tool_calls = []
            for tool_call in message.tool_calls:
                tool_calls.append({
                    "id": tool_call.id,
                    "name": tool_call.function.name,
                    "args": json.loads(tool_call.function.arguments)
                })
        
        # 提取reasoning_content
        reasoning_content = None
        if hasattr(message, 'reasoning_content'):
            reasoning_content = message.reasoning_content
        
        # 构造元数据
        response_metadata = {
            "finish_reason": choice.finish_reason,
            "model_name": self.model,
            "model_provider": self._extract_model_provider(self.model)
        }
        
        # 构造usage_metadata
        usage_metadata = None
        if hasattr(response, 'usage') and response.usage:
            usage_metadata = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        
        # 构造最终消息
        final_message = AIMessage(
            content=message.content or "",
            tool_calls=tool_calls,
            response_metadata=response_metadata,
            usage_metadata=usage_metadata,
            additional_kwargs={"reasoning_content": reasoning_content} if reasoning_content else {}
        )
        
        generation = ChatGeneration(message=final_message)
        return ChatResult(generations=[generation])
    
    async def _astream(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        """
        异步流式生成响应
        """
        # 转换消息格式
        formatted_messages = self._format_messages(messages)
        
        # 获取tools参数
        tools = kwargs.get("tools", self.tools)
        tools = self._convert_tools_to_openai_format(tools)
        
        # 构建调用参数（需要stream_options才能显示上下文开销）
        call_kwargs = {
            "model": self.model,
            "messages": formatted_messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "timeout": self.timeout,
            "stream": True,
            "stream_options" : {"include_usage": True},
        }
        
        # 添加可选参数
        if self.api_key:
            call_kwargs["api_key"] = self.api_key
        if self.base_url:
            call_kwargs["base_url"] = self.base_url
        if tools:
            call_kwargs["tools"] = tools
        if stop:
            call_kwargs["stop"] = stop
        
        # 用于收集元数据
        response_id = None
        finish_reason = None
        usage_info = None
        
        # 调用LiteLLM流式API
        try:
            print("api_key:",self.api_key)
            response_stream = await acompletion(**call_kwargs)
        except Exception as e:
            logger.error(f"LiteLLM流式调用失败: {e}")
            raise e
        
        # 处理流式响应
        async for chunk in response_stream:
            # 收集响应ID
            if not response_id and hasattr(chunk, 'id'):
                response_id = chunk.id
            
            # 收集usage信息（通常在最后一个chunk中）
            if hasattr(chunk, 'usage') and chunk.usage:
                usage_info = chunk.usage
            
            # 处理choices
            if not chunk.choices:
                continue
            
            choice = chunk.choices[0]
            
            # 收集finish_reason
            if hasattr(choice, 'finish_reason') and choice.finish_reason:
                finish_reason = choice.finish_reason
            
            delta = choice.delta
            
            # 处理内容
            if hasattr(delta, 'content') and delta.content:
                message = AIMessageChunk(content=delta.content)
                yield ChatGenerationChunk(message=message)
            
            # 处理reasoning_content
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                message = AIMessageChunk(
                    content="",
                    additional_kwargs={"reasoning_content": delta.reasoning_content}
                )
                yield ChatGenerationChunk(message=message)
            
            # 处理工具调用
            if hasattr(delta, 'tool_calls') and delta.tool_calls:
                for tool_call in delta.tool_calls:
                    tc_chunk = {
                        "index": 0,
                        "id": tool_call.id,
                        "name": tool_call.function.name if tool_call.function else None,
                        "args": tool_call.function.arguments if tool_call.function else ""
                    }
                    tool_message = AIMessageChunk(
                        content="",
                        tool_call_chunks=[tc_chunk]
                    )
                    yield ChatGenerationChunk(message=tool_message)
        
        # 构造response_metadata
        response_metadata = {
            "finish_reason": finish_reason or "stop",
            "model_name": self.model,
            "model_provider": self._extract_model_provider(self.model)
        }
        
        # 构造usage_metadata
        usage_metadata = None
        if usage_info:
            usage_metadata = {
                "input_tokens": usage_info.prompt_tokens,
                "output_tokens": usage_info.completion_tokens,
                "total_tokens": usage_info.total_tokens
            }
        
        # 流式结束后，发送最终的元数据消息
        metadata_message = AIMessageChunk(
            content="",
            response_metadata=response_metadata,
            usage_metadata=usage_metadata
        )
        yield ChatGenerationChunk(message=metadata_message)
    
    def _extract_model_provider(self, model: str) -> str:
        """
        从模型名称中提取提供商
        例如: "openai/gpt-4" -> "openai"
              "anthropic/claude-3" -> "anthropic"
        """
        if "/" in model:
            return model.split("/")[0]
        return model.split("-")[0] if "-" in model else model
    
    @property
    def _llm_type(self) -> str:
        return "litellm"
    
    def bind_tools(self, tools, **kwargs):
        """
        绑定工具到模型
        """
        bound_model = self.model_copy(update={"tools": tools, **kwargs})
        return bound_model
