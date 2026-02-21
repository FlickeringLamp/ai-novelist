from typing import Optional, List, Any, Dict, AsyncIterator
from langchain_core.messages import BaseMessage, AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.outputs import ChatResult, ChatGeneration, ChatGenerationChunk
from langchain_core.tools import BaseTool
from pydantic import Field, model_validator
from openai import AsyncOpenAI as AsyncOpenAIClient
import json
import asyncio

class OpenAICompatibleChatModel(BaseChatModel):
    """
    OpenAI兼容自定义模型类 - 支持工具调用
    """
    base_url: Optional[str] = Field(default=None)
    api_key: Optional[str] = Field(default=None)
    timeout: int = Field(default=30)
    model: Optional[str] = Field(default=None)
    temperature: float = Field(default=0.7)
    max_tokens: int = Field(default=4096)
    tools: Optional[List[BaseTool]] = Field(default=None)
    
    @model_validator(mode='after')
    def initialize_client(self):
        """使用base_url、api_key、timeout创建client"""
        if self.base_url and self.api_key:
            self._client = AsyncOpenAIClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout
            )
        return self
    
    
    def _format_messages(self, messages: List[BaseMessage]) -> List[Dict[str, Any]]:
        """
        将LangChain消息格式转换为OpenAI格式
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
                # 检查 msg 对象是否有名为 'tool_calls' 的属性
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
        
        Args:
            tools: LangChain工具列表
            
        Returns:
            OpenAI API格式的工具列表
        """
        if not tools:
            return None
        
        openai_tools = []
        for tool in tools:
            # 如果是LangChain工具对象，转换为OpenAI格式
            # name: 自动从函数名获取
            # description: 自动从函数的 docstring 获取
            # parameters: 通过 args_schema 参数传入的 Pydantic BaseModel，调用其 model_json_schema() 方法生成 JSON Schema
            if isinstance(tool, BaseTool):
                tool_schema = {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.args_schema.model_json_schema() if tool.args_schema else {"type": "object", "properties": {}}
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
        生成响应（非流式，内部调用_astream并收集结果）
        """
        # 收集所有流式结果和元数据
        chunks = []
        response_metadata = {}
        usage_metadata = {}
        reasoning_content_parts = []
        async def collect_chunks():
            async for chunk in self._astream(messages, stop, run_manager, **kwargs):
                chunks.append(chunk)
        
        # 运行异步函数
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        loop.run_until_complete(collect_chunks())
        
        # 合并所有chunk为一个完整的消息
        content_parts = []
        reasoning_content_parts = []
        tool_calls_buffer = {}
        
        for chunk in chunks:
            message = chunk.message
            if message.content:
                content_parts.append(message.content)
            # 收集reasoning_content（思维链内容）
            if hasattr(message, 'additional_kwargs') and 'reasoning_content' in message.additional_kwargs:
                reasoning_content_parts.append(message.additional_kwargs['reasoning_content'])
            if hasattr(message, 'tool_calls') and message.tool_calls:
                for tool_call in message.tool_calls:
                    call_id = tool_call["id"]
                    if call_id not in tool_calls_buffer:
                        tool_calls_buffer[call_id] = tool_call
            # 收集元数据
            if hasattr(message, 'response_metadata') and message.response_metadata:
                response_metadata.update(message.response_metadata)
            if hasattr(message, 'usage_metadata') and message.usage_metadata:
                usage_metadata.update(message.usage_metadata)
        
        full_content = "".join(content_parts)
        full_reasoning_content = "".join(reasoning_content_parts) if reasoning_content_parts else None
        tool_calls = list(tool_calls_buffer.values()) if tool_calls_buffer else None
        
        # 构造最终消息，包含完整元数据和reasoning_content
        final_message = AIMessage(
            content=full_content,
            tool_calls=tool_calls,
            response_metadata=response_metadata if response_metadata else {},
            usage_metadata=usage_metadata if usage_metadata else None,
            additional_kwargs={"reasoning_content": full_reasoning_content} if full_reasoning_content else {}
        )
        
        generation = ChatGeneration(message=final_message)
        return ChatResult(generations=[generation])
    
    def _extract_model_provider(self, model: str) -> str:
        """
        从模型名称中提取提供商
        
        Args:
            model: 模型名称，如 "Pro/zai-org/GLM-4.7" 或 "deepseek-chat"
            
        Returns:
            提供商名称
        """
        if "/" in model:
            # 格式如 "Pro/zai-org/GLM-4.7"，提取第二部分作为提供商? 这个地方有点问题，deepseek/deepseek-v3.2这种处理不了。（虽然这个数据我们又不用，错了就错了）
            parts = model.split("/")
            if len(parts) >= 2:
                return parts[1]
        # 格式如 "deepseek-chat"，提取第一部分作为提供商
        return model.split("-")[0] if "-" in model else model
    
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
        
        # 获取tools参数（优先使用实例属性，其次使用kwargs）
        tools = kwargs.get("tools", self.tools)
        
        # 转换工具为OpenAI格式
        tools = self._convert_tools_to_openai_format(tools)
        
        # 调用OpenAI兼容API（异步流式）
        response = await self._client.chat.completions.create(
            model=self.model,
            messages=formatted_messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            stream=True,
            tools=tools
        )
        
        # 用于收集usage信息
        response_id = None
        finish_reason = None
        system_fingerprint = None
        usage_info = None
        
        # 处理流式响应
        async for chunk in response:
            print("chunk:",chunk)
            # 收集响应元数据
            if not response_id:
                response_id = chunk.id
            
            # 收集usage信息（通常在最后一个chunk中）
            # 优先从choices中获取usage（kimi等API将usage放在choices[0].usage）
            if chunk.choices and hasattr(chunk.choices[0], 'usage') and chunk.choices[0].usage:
                usage_info = chunk.choices[0].usage
            elif hasattr(chunk, 'usage') and chunk.usage:
                usage_info = chunk.usage
            
            # 处理流式响应
            if not chunk.choices:
                continue
            
            delta = chunk.choices[0].delta
            choice = chunk.choices[0]
            
            # 收集finish_reason
            if choice.finish_reason:
                finish_reason = choice.finish_reason
            
            # 收集system_fingerprint
            if hasattr(chunk, 'system_fingerprint') and chunk.system_fingerprint:
                system_fingerprint = chunk.system_fingerprint
            
            # 处理内容
            if delta.content:
                message = AIMessageChunk(content=delta.content)
                yield ChatGenerationChunk(message=message)
            
            # 处理reasoning_content（思维链内容）
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                message = AIMessageChunk(
                    content="",
                    additional_kwargs={"reasoning_content": delta.reasoning_content}
                )
                yield ChatGenerationChunk(message=message)
            
            # 处理工具调用 - 使用tool_call_chunks传递不完整的调用信息
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
        if system_fingerprint:
            response_metadata["system_fingerprint"] = system_fingerprint
        
        # 构造usage_metadata
        usage_metadata = None
        if usage_info:
            # 兼容字典和对象两种访问方式
            def get_attr(obj, key, default=None):
                if isinstance(obj, dict):
                    return obj.get(key, default)
                return getattr(obj, key, default)
            
            usage_metadata = {
                "input_tokens": get_attr(usage_info, 'prompt_tokens'),
                "output_tokens": get_attr(usage_info, 'completion_tokens'),
                "total_tokens": get_attr(usage_info, 'total_tokens')
            }
            # 添加详细的token信息
            input_details = {}
            output_details = {}
            
            # kimi使用cached_tokens，其他API可能使用prompt_cache_hit_tokens
            cached_tokens = get_attr(usage_info, 'cached_tokens') or get_attr(usage_info, 'prompt_cache_hit_tokens')
            if cached_tokens:
                input_details["cache_read"] = cached_tokens
            
            completion_details = get_attr(usage_info, 'completion_tokens_details')
            if completion_details:
                reasoning_tokens = get_attr(completion_details, 'reasoning_tokens')
                if reasoning_tokens:
                    output_details["reasoning_tokens"] = reasoning_tokens
            
            if input_details:
                usage_metadata["input_token_details"] = input_details
            if output_details:
                usage_metadata["output_token_details"] = output_details
        
        # 流式结束后，发送最终的元数据消息
        metadata_message = AIMessageChunk(
            content="",
            response_metadata=response_metadata,
            usage_metadata=usage_metadata
        )
        yield ChatGenerationChunk(message=metadata_message)
    
    @property
    def _llm_type(self) -> str:
        return "openai_compatible"
    
    def bind_tools(self, tools, **kwargs):
        """
        绑定工具到模型（支持工具调用）
        
        Args:
            tools: 工具列表
            **kwargs: 其他参数
            
        Returns:
            绑定工具后的模型实例
        """
        # 将工具信息存储在模型实例中
        bound_model = self.model_copy(update={"tools": tools, **kwargs})
        return bound_model
