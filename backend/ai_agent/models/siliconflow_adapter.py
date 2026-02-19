from typing import Optional, List, Any, Dict, Iterator, AsyncIterator
from langchain_core.messages import BaseMessage, AIMessage, AIMessageChunk, ToolMessage, HumanMessage, SystemMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.outputs import ChatGeneration, ChatResult, ChatGenerationChunk
from pydantic import Field
from openai import AsyncOpenAI as AsyncOpenAIClient
import json

class SiliconFlowChatModel(BaseChatModel):
    """
    硅基流动自定义模型类
    支持流式输出和Function Calling
    """
    
    client: Optional[AsyncOpenAIClient] = Field(default=None)
    model: Optional[str] = Field(default=None)
    temperature: float = 0.7
    max_tokens: int = 4096
    timeout: int = 30
    
    def _stream(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        """
        流式生成响应（同步方法，内部使用异步客户端）
        """
        # 转换消息格式
        formatted_messages = self._format_messages(messages)
        
        # 获取tools参数
        tools = kwargs.get("tools", None)
        
        # 用于收集usage信息和工具调用
        usage_info = None
        tool_calls_buffer = {}  # 用于收集工具调用的片段
        
        # 调用硅基流动API（异步流式，使用 asyncio.run_until_complete）
        async def async_stream():
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=formatted_messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=True,
                tools=tools
            )
            
            # 处理流式响应
            chunks = []
            async for chunk in response:
                chunks.append(chunk)
            
            return chunks
        
        # 运行异步函数
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        chunks = loop.run_until_complete(async_stream())
        
        # 处理流式响应
        for chunk in chunks:
            if not chunk.choices:
                continue
            
            delta = chunk.choices[0].delta
            
            # 处理内容
            if delta.content:
                message = AIMessageChunk(content=delta.content)
                yield ChatGenerationChunk(message=message)
            
            # 处理推理内容（如果有）
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                message = AIMessageChunk(content=delta.reasoning_content)
                yield ChatGenerationChunk(message=message)
            
            # 处理工具调用
            if hasattr(delta, 'tool_calls') and delta.tool_calls:
                for tool_call in delta.tool_calls:
                    call_id = tool_call.id
                    
                    # 初始化工具调用缓冲区
                    if call_id not in tool_calls_buffer:
                        tool_calls_buffer[call_id] = {
                            "id": call_id,
                            "name": None,
                            "arguments": ""
                        }
                    
                    # 收集工具调用信息
                    if tool_call.function and tool_call.function.name:
                        tool_calls_buffer[call_id]["name"] = tool_call.function.name
                    
                    if tool_call.function and tool_call.function.arguments:
                        tool_calls_buffer[call_id]["arguments"] += tool_call.function.arguments
            
            # 收集usage信息（在最后一个chunk中）
            if hasattr(chunk, 'usage') and chunk.usage:
                usage_info = chunk.usage
        
        # 如果有工具调用，发送一个包含工具调用的AIMessage
        if tool_calls_buffer:
            tool_calls = []
            for call_id, call_data in tool_calls_buffer.items():
                if call_data["name"] and call_data["arguments"]:
                    try:
                        args = json.loads(call_data["arguments"])
                        tool_calls.append({
                            "id": call_id,
                            "name": call_data["name"],
                            "args": args
                        })
                    except json.JSONDecodeError:
                        # 如果参数不完整，跳过这个工具调用
                        pass
            
            if tool_calls:
                tool_message = AIMessageChunk(content="", tool_calls=tool_calls)
                yield ChatGenerationChunk(message=tool_message)
        
        # 如果有usage信息，发送一个带有usage_metadata的最终消息
        if usage_info:
            usage_metadata = self._convert_usage_to_metadata(usage_info)
            # 发送一个空内容的AIMessageChunk，只包含usage_metadata
            final_message = AIMessageChunk(content="", usage_metadata=usage_metadata)
            yield ChatGenerationChunk(message=final_message)
    
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """
        生成响应（非流式，同步方法，内部使用异步客户端）
        """
        # 转换消息格式
        formatted_messages = self._format_messages(messages)
        
        # 获取tools参数
        tools = kwargs.get("tools", None)
        
        # 调用硅基流动API（异步非流式，使用 asyncio.run_until_complete）
        async def async_generate():
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=formatted_messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=False,
                tools=tools
            )
            return response
        
        # 运行异步函数
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        response = loop.run_until_complete(async_generate())
        
        # 转换响应为ChatResult
        message = self._convert_response_to_message(response)
        
        # 添加usage_metadata
        if hasattr(response, 'usage') and response.usage:
            usage_metadata = self._convert_usage_to_metadata(response.usage)
            message.usage_metadata = usage_metadata
        
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])
    
    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """
        异步生成响应（非流式）
        """
        # 转换消息格式
        formatted_messages = self._format_messages(messages)
        
        # 获取tools参数
        tools = kwargs.get("tools", None)
        
        # 调用硅基流动API（非流式）
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=formatted_messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            stream=False,
            tools=tools
        )
        
        # 转换响应为ChatResult
        message = self._convert_response_to_message(response)
        
        # 添加usage_metadata
        if hasattr(response, 'usage') and response.usage:
            usage_metadata = self._convert_usage_to_metadata(response.usage)
            message.usage_metadata = usage_metadata
        
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])
    
    def _convert_response_to_message(self, response) -> AIMessage:
        """
        将OpenAI响应转换为LangChain消息
        """
        choice = response.choices[0]
        message = choice.message
        
        # 检查是否有工具调用
        if hasattr(message, 'tool_calls') and message.tool_calls:
            tool_calls = []
            for tool_call in message.tool_calls:
                tool_calls.append({
                    "id": tool_call.id,
                    "name": tool_call.function.name,
                    "args": json.loads(tool_call.function.arguments)
                })
            return AIMessage(content=message.content or "", tool_calls=tool_calls)
        
        # 普通消息
        return AIMessage(content=message.content or "")
    
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
        tools = kwargs.get("tools", None)
        
        # 调用硅基流动API（异步流式）
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=formatted_messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            stream=True,
            tools=tools
        )
        
        # 用于收集usage信息和工具调用
        usage_info = None
        tool_calls_buffer = {}  # 用于收集工具调用的片段
        
        # 处理流式响应
        async for chunk in response:
            if not chunk.choices:
                continue
            
            delta = chunk.choices[0].delta
            
            # 处理内容
            if delta.content:
                message = AIMessageChunk(content=delta.content)
                yield ChatGenerationChunk(message=message)
            
            # 处理推理内容（如果有）
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                message = AIMessageChunk(content=delta.reasoning_content)
                yield ChatGenerationChunk(message=message)
            
            # 处理工具调用
            if hasattr(delta, 'tool_calls') and delta.tool_calls:
                for tool_call in delta.tool_calls:
                    call_id = tool_call.id
                    
                    # 初始化工具调用缓冲区
                    if call_id not in tool_calls_buffer:
                        tool_calls_buffer[call_id] = {
                            "id": call_id,
                            "name": None,
                            "arguments": ""
                        }
                    
                    # 收集工具调用信息
                    if tool_call.function and tool_call.function.name:
                        tool_calls_buffer[call_id]["name"] = tool_call.function.name
                    
                    if tool_call.function and tool_call.function.arguments:
                        tool_calls_buffer[call_id]["arguments"] += tool_call.function.arguments
            
            # 收集usage信息（在最后一个chunk中）
            if hasattr(chunk, 'usage') and chunk.usage:
                usage_info = chunk.usage
        
        # 如果有工具调用，发送一个包含工具调用的AIMessage
        if tool_calls_buffer:
            tool_calls = []
            for call_id, call_data in tool_calls_buffer.items():
                if call_data["name"] and call_data["arguments"]:
                    try:
                        args = json.loads(call_data["arguments"])
                        tool_calls.append({
                            "id": call_id,
                            "name": call_data["name"],
                            "args": args
                        })
                    except json.JSONDecodeError:
                        # 如果参数不完整，跳过这个工具调用
                        pass
            
            if tool_calls:
                tool_message = AIMessageChunk(content="", tool_calls=tool_calls)
                yield ChatGenerationChunk(message=tool_message)
        
        # 如果有usage信息，发送一个带有usage_metadata的最终消息
        if usage_info:
            usage_metadata = self._convert_usage_to_metadata(usage_info)
            # 发送一个空内容的AIMessageChunk，只包含usage_metadata
            final_message = AIMessageChunk(content="", usage_metadata=usage_metadata)
            yield ChatGenerationChunk(message=final_message)
    
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
                # 处理AIMessage，可能包含tool_calls
                assistant_msg = {"role": "assistant", "content": msg.content or ""}
                
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
                
                formatted.append(assistant_msg)
            elif isinstance(msg, ToolMessage):
                formatted.append({"role": "tool", "content": msg.content, "tool_call_id": msg.tool_call_id})
        return formatted
    
    def _convert_usage_to_metadata(self, usage) -> Dict[str, Any]:
        """
        将硅基流动的usage信息转换为LangChain的usage_metadata格式
        """
        output_token_details = {}
        if hasattr(usage, 'completion_tokens_details') and usage.completion_tokens_details:
            if hasattr(usage.completion_tokens_details, 'reasoning_tokens'):
                output_token_details['reasoning'] = usage.completion_tokens_details.reasoning_tokens
        
        return {
            'input_tokens': usage.prompt_tokens,
            'output_tokens': usage.completion_tokens,
            'total_tokens': usage.total_tokens,
            'input_token_details': {},
            'output_token_details': output_token_details
        }
    
    @property
    def _llm_type(self) -> str:
        return "siliconflow"
    
    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        }