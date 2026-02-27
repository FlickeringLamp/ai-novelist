from langchain_mcp_adapters.client import MultiServerMCPClient
from backend.config.config import settings


def convert_to_langchain_config(mcp_servers: dict) -> dict:
    """
    将MCP服务器配置转换为langchain客户端需要的格式
    
    Args:
        mcp_servers: MCP服务器配置字典
        
    Returns:
        Dict: langchain客户端需要的配置格式
    """
    langchain_config = {}
    for server_id, server_config in mcp_servers.items():
        # 只处理激活的服务器
        if not server_config.get("isActive", True):
            continue
            
        config = {
            "transport": server_config.get("type", "stdio")
        }
        
        # 根据transport类型添加不同的配置
        if config["transport"] == "stdio":
            if server_config.get("command"):
                config["command"] = server_config["command"]
            if server_config.get("args"):
                config["args"] = server_config["args"]
            if server_config.get("env"):
                config["env"] = server_config["env"]
        elif config["transport"] == "http":
            if server_config.get("baseUrl"):
                config["url"] = server_config["baseUrl"]
        
        langchain_config[server_id] = config
    
    return langchain_config


# 初始化langchain客户端
mcp_servers_config = settings.get_config("mcpServers", default={})
langchain_config = convert_to_langchain_config(mcp_servers_config)
client = MultiServerMCPClient(langchain_config)


def get_all_mcp_servers():
    """
    获取所有MCP服务器配置
    
    Returns:
        Dict[str, Dict]: 所有MCP服务器配置
    """
    return settings.get_config("mcpServers", default={})


def add_mcp_server(server_id: str, server_config: dict):
    """
    添加新的MCP服务器配置
    
    Args:
        server_id: MCP服务器ID
        server_config: MCP服务器配置字典
        
    Returns:
        Dict[str, Dict]: 更新后的所有MCP服务器配置
    """
    mcp_servers = settings.get_config("mcpServers", default={})
    mcp_servers[server_id] = server_config
    settings.update_config(mcp_servers, "mcpServers")
    return mcp_servers


def update_mcp_server(server_id: str, server_config: dict):
    """
    更新指定的MCP服务器配置
    
    Args:
        server_id: MCP服务器ID
        server_config: 要更新的配置字段（只更新提供的字段）
        
    Returns:
        Dict[str, Dict]: 更新后的所有MCP服务器配置
    """
    mcp_servers = settings.get_config("mcpServers", default={})
    
    if server_id not in mcp_servers:
        raise ValueError(f"MCP服务器 {server_id} 不存在")
    
    current_config = mcp_servers[server_id]
    updated_config = current_config.copy()
    
    for key, value in server_config.items():
        updated_config[key] = value
    
    mcp_servers[server_id] = updated_config
    settings.update_config(mcp_servers, "mcpServers")
    return mcp_servers


def delete_mcp_server(server_id: str):
    """
   删除指定的MCP服务器配置
    
    Args:
        server_id: MCP服务器ID
        
    Returns:
        Dict[str, Dict]: 更新后的所有MCP服务器配置
    """
    mcp_servers = settings.get_config("mcpServers", default={})
    
    if server_id not in mcp_servers:
        raise ValueError(f"MCP服务器 {server_id} 不存在")
    
    del mcp_servers[server_id]
    settings.update_config(mcp_servers, "mcpServers")
    return mcp_servers


async def get_mcp_tools():
    """获取MCP工具并返回工具字典"""
    McpTools = await client.get_tools()
    # 将BaseTool列表转换为可序列化的字典
    tools_dict = {}
    for tool in McpTools:
        tools_dict[tool.name] = {
            "name": tool.name,
            "description": tool.description,
            "inputSchema": getattr(tool, 'args_schema', None)
        }
    return tools_dict

