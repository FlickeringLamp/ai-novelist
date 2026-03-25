/**
 * MCP工具定义
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
}

/**
 * MCP服务器配置（从后端获取的静态配置）
 */
export interface mcpServers {
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

/**
 * MCP数据 - 包含选中的服务器ID、配置和工具列表
 */
export interface MCPData {
  selectedId: string | null;
  config: {
    [serverId: string]: mcpServers;
  };
  tools: {
    [serverId: string]: MCPTool[];
  };
  toolsError: {
    [serverId: string]: string | null;
  };
}
