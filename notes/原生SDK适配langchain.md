from langchain_core.language_models.chat_models import BaseChatModel

BaseChatModel是关键
继承自LangChain的BaseChatModel，目的是让硅基流动的API能够无缝集成到LangChain生态系统中
BaseChatModel 是一个抽象基类，强制要求子类实现核心方法，否则会抛出 NotImplementedError。

_identifying_params	可选
_stream	可选
_agenerate	可选
_astream  可选

_llm_type 必选
_generate 必选

https://reference.langchain.com/python/langchain_core/language_models/#langchain_core.language_models.BaseChatModel



---


类属性，创建时传入
```py
    client: Optional[AsyncOpenAIClient] = Field(default=None)
    model: Optional[str] = Field(default=None)
    temperature: float = 0.7
    max_tokens: int = 4096
    tools: Optional[List[Any]] = Field(default=None)
```
引入Optional,str等，可以表明是否可选，是什么类型。Field用来表明额外信息，如描述，别名，最值。

from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_core.tools import BaseTool
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage


——————
工具调用异常，总是报错json格式不对？

function=ChoiceDeltaToolCallFunction(arguments='', name='list_base_files')
function=ChoiceDeltaToolCallFunction(arguments='{', name=None)
省略部分内容
(arguments='"collection_id": "db_1771236780434"', name=None)
(arguments='}', name=None)


content='我来查看一下知识库中的文件，然后进行一些操作。\n\n' additional_kwargs={} response_metadata={'finish_reason': 'tool_calls', 'model_name': 'deepseek-ai/DeepSeek-V3.2', 'model_provider': 'DeepSeek-V3.2'} id='lc_run--019c763d-e689-72d2-a22d-f21c33a4ae27' tool_calls=[{'name': 'list_base_files', 'args': {}, 'id': '019c763df87dc08508f552d0f39035d8', 'type': 'tool_call'}, {'name': '', 'args': {}, 'id': None, 'type': 'tool_call'}, {'name': '', 'args': {}, 'id': None, 'type': 'tool_call'}, {'name': '', 'args': {'collection_id': 'db_1771236780434'}, 'id': None, 'type': 'tool_call'}] invalid_tool_calls=[] usage_metadata={'input_tokens': 3032, 'output_tokens': 63, 'total_tokens': 3095}


pydantic_core._pydantic_core.ValidationError: 1 validation error for ListKnowledgeBaseInput
collection_id
  Field required [type=missing, input_value={}, input_type=dict]
    For further information visit https://errors.pydantic.dev/2.12/v/missing
During task with name 'tools' and id '62dd56d0-fa74-ea83-699e-d8266c9d8f27'


原因是放进了tool_calls，实际上这种不完整的chunk应该放进tool_call_chunks键，然后才传入AIMessageChunk

工具绑定机制：

**绑定位置**：`bind_tools()` 方法通过 `self.model_copy(update={"tools": tools})` 将工具存储在新模型实例的 `tools` 属性。
每次绑定工具都返回新实例，不影响原始模型。