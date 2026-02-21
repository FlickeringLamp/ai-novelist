// LangGraph State类型定义 - 直接对应后端序列化后的结构

// 工具调用（从AIMessage中）
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id: string;
  type: string;
}

// 无效工具调用
export interface InvalidToolCall {
  name?: string;
  id?: string;
  args?: string;
  error?: string;
}

// 使用元数据
export interface UsageMetadata {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_token_details?: {
    cache_read?: number;
    cached_tokens?: number;  // 阿里云格式
  };
  output_token_details?: Record<string, unknown>;
}

// 阿里云Token使用信息（在response_metadata中）
export interface AliyunTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  // 兼容智谱模型格式
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

// 响应元数据（兼容阿里云和ChatOpenAI格式）
export interface ResponseMetadata {
  finish_reason?: string;
  model_name?: string;
  system_fingerprint?: string;
  model_provider?: string;
  // 阿里云特有字段
  request_id?: string;
  token_usage?: AliyunTokenUsage;
}

// 基础消息接口
export interface BaseMessage {
  content: string;
  additional_kwargs: Record<string, unknown>;
  response_metadata: ResponseMetadata;
  id: string;
  type: 'human' | 'ai' | 'tool' | 'unknown';
}

// HumanMessage
export interface HumanMessage extends BaseMessage {
  type: 'human';
}

// AIMessage
export interface AIMessage extends BaseMessage {
  type: 'ai';
  tool_calls: ToolCall[];
  invalid_tool_calls: InvalidToolCall[];
  usage_metadata?: UsageMetadata;
}

// ToolMessage
export interface ToolMessage extends BaseMessage {
  type: 'tool';
  tool_call_id?: string;
}

// 消息联合类型
export type Message = HumanMessage | AIMessage | ToolMessage;

// 中断值
export interface InterruptValue {
  tool_name: string;
  tool_display_name?: string;
  description?: string;
  question?: string;
  parameters?: Record<string, unknown>;
}

// 中断信息
export interface Interrupt {
  id: string;
  value: InterruptValue;
}

// 中断响应接口
export interface InterruptResponse {
  action: 'approve' | 'reject';
  choice?: string;
  additionalData?: string;
}

// 任务
export interface PregelTask {
  id: string;
  name: string;
  path: string[];
  error: any;
  interrupts: Interrupt[];
  state: any;
  result: any;
}

// 配置
export interface Config {
  configurable: {
    thread_id: string;
    checkpoint_ns?: string;
    checkpoint_id?: string;
    user_id?: string;
  };
}

// 元数据
export interface StateMetadata {
  source: string;
  step: number;
  parents: Record<string, unknown>;
  user_id: string;
}

// LangGraph State
export interface LangGraphState {
  values: {
    messages: Message[];
    summary: string;
  };
  next: string[] | null;
  config: Config;
  metadata: StateMetadata;
  created_at: string;
  parent_config: Config | null;
  tasks: PregelTask[];
  interrupts: Interrupt[];
}

// 流式传输的chunk类型
export interface StreamChunk {
  type?: string;
  content?: string;
  tool_calls?: ToolCall[];
  id?: string;
  name?: string | null;
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: ResponseMetadata;
  usage_metadata?: UsageMetadata | null;
  invalid_tool_calls?: InvalidToolCall[];
  tool_call_chunks?: ToolCallChunk[];
  chunk_position?: string | null;
  // 流式传输ID（用于中断流式传输）
  stream_id?: string;
  // 是否被中断
  interrupted?: boolean;
}

// 工具调用chunk（用于流式传输）
export interface ToolCallChunk {
  name?: string | null;
  args?: string | null;
  id?: string | null;
  index?: number;
  type?: string;
}
