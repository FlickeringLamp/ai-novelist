export interface MCPServerConfig {
  name: string;
  description: string;
  baseUrl: string;
  isActive: boolean;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
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
