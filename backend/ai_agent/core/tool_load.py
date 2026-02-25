from backend.config.config import settings
from backend.ai_agent.tool.embedding_tool.emb_search import search_embedding, list_base_files
from backend.ai_agent.tool.file_tool.read_file import read_file
from backend.ai_agent.tool.file_tool.write_file import write_file
from backend.ai_agent.tool.file_tool.apply_diff import apply_diff
from backend.ai_agent.tool.file_tool.insert_content import insert_content
from backend.ai_agent.tool.file_tool.search_file import search_file
from backend.ai_agent.tool.file_tool.search_and_replace import search_and_replace
from backend.ai_agent.tool.operation_tool.ask_user import ask_user_question
from backend.ai_agent.mcp_client import MCPClient, MCPToolAdapter
from backend.config.mcp_servers import MCPServerConfigManager


def import_tools_from_directory(tool_dir: str, mode: str = None):
    """直接导入所有工具，支持按模式过滤
    
    Args:
        tool_dir: 工具目录（未使用，保留参数兼容性）
        mode: 模式名称，如果提供则只导入该模式启用的工具
    """
    # 所有可用工具的字典
    all_tools = {
        "search_embedding": search_embedding,
        "list_base_files": list_base_files,
        "read_file": read_file,
        "write_file": write_file,
        "apply_diff": apply_diff,
        "insert_content": insert_content,
        "search_file": search_file,
        "search_and_replace": search_and_replace,
        "ask_user_question": ask_user_question
    }
    
    # 根据模式过滤工具
    if mode:
        # 获取模式启用的工具列表
        enabled_tools = settings.get_config("mode", mode, "tools", default=[])
        print(f"[INFO] 模式 '{mode}' 启用的工具: {enabled_tools}")
        # 只返回该模式启用的工具
        tools = {tool_name: all_tools[tool_name] for tool_name in enabled_tools if tool_name in all_tools}
    else:
        # 如果没有指定模式，返回所有工具
        tools = all_tools
    
    for tool_name in tools:
        print(f"[OK] 已导入工具: {tool_name}")
    
    print(f"[INFO] 总共导入 {len(tools)} 个工具")
    return tools


def import_tools_with_mcp(tool_dir: str = None, mode: str = None, enable_mcp: bool = True):
    """导入工具，包括本地工具和MCP工具
    
    Args:
        tool_dir: 工具目录（未使用，保留参数兼容性）
        mode: 模式名称，如果提供则只导入该模式启用的工具
        enable_mcp: 是否启用MCP工具
    """
    # 导入本地工具
    tools = import_tools_from_directory(tool_dir, mode)
    
    # 如果启用MCP，导入MCP工具
    if enable_mcp:
        mcp_tools = import_mcp_tools(mode)
        tools.update(mcp_tools)
    
    return tools


def import_mcp_tools(mode: str = None):
    """导入MCP工具
    
    Args:
        mode: 模式名称，如果提供则只导入该模式启用的MCP工具
    """
    import asyncio
    
    # 创建MCP客户端和配置管理器
    mcp_client = MCPClient()
    mcp_config_manager = MCPServerConfigManager(settings)
    
    # 获取启用的MCP服务器
    enabled_servers = mcp_config_manager.get_enabled_servers()
    
    if not enabled_servers:
        print("[INFO] 没有启用的MCP服务器")
        return {}
    
    # 添加服务器配置到客户端
    from backend.ai_agent.mcp_client.mcp_client import MCPServerConfig
    for server_name, server_config in enabled_servers.items():
        config = MCPServerConfig(
            name=server_config["name"],
            command=server_config["command"],
            args=server_config.get("args", []),
            transport=server_config.get("transport", "stdio")
        )
        mcp_client.add_server(config)
    
    # 连接所有服务器
    try:
        asyncio.run(mcp_client.connect_all())
    except Exception as e:
        print(f"[ERROR] 连接MCP服务器失败: {str(e)}")
        return {}
    
    # 创建工具适配器并适配工具
    adapter = MCPToolAdapter(mcp_client)
    mcp_tools = adapter.adapt_tools()
    
    # 根据模式过滤MCP工具
    if mode:
        # 获取模式启用的工具列表
        enabled_tools = settings.get_config("mode", mode, "tools", default=[])
        # 只返回该模式启用的MCP工具
        mcp_tools = {
            tool_name: tool_func
            for tool_name, tool_func in mcp_tools.items()
            if tool_name in enabled_tools
        }
    
    print(f"[INFO] 总共导入 {len(mcp_tools)} 个MCP工具")
    return mcp_tools
