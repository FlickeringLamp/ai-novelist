export interface MCPServerConfig {
  name: string;
  description: string;
  url: string;
  isActive: boolean;
  transport: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  /** 环境变量名列表 */
  env?: string[];
  /** 环境变量值（从 .env 文件读取） */
  envValues?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface MCPServerData {
  [serverId: string]: MCPServerConfig;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
}

export interface MCPToolsData {
  [toolName: string]: MCPTool;
}
