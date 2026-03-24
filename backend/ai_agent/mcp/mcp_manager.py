import logging
from pathlib import Path
from langchain_mcp_adapters.client import MultiServerMCPClient
from backend.settings.settings import settings

logger = logging.getLogger(__name__)


def convert_to_langchain_config(mcp_servers: dict) -> dict:
    """
    将我们自定义的MCP服务器配置格式，转换为langchain客户端需要的格式
    
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
            "transport": server_config.get("transport", "stdio")
        }
        
        # 根据transport类型添加不同的配置
        if config["transport"] == "stdio":
            if server_config.get("command"):
                command = server_config.get("command")
                args = server_config.get("args", [])
                  
                # 处理 uvx 命令
                if command == "uvx":
                    # 使用项目自带的 uvx
                    command = settings.UVX_EXECUTABLE
                    # 添加阿里镜像源参数（Python 包镜像）
                    args = ["--index-url", "https://mirrors.aliyun.com/pypi/simple/"] + args
                    logger.info(f"使用 uvx 命令 (阿里镜像源): {command} {' '.join(args)}")
                elif command == "npx":
                    # 使用项目自带的 node.exe 执行 npx-cli.js
                    node_exe = Path(settings.NODE_EXECUTABLE)
                    npx_cli_js = node_exe.parent / "npm" / "package" / "bin" / "npx-cli.js"
                    
                    # 如果项目自带的 node.exe 和 npx-cli.js 都存在
                    if node_exe.exists() and npx_cli_js.exists():
                        command = str(node_exe)
                        # 在 args 前面插入 npx-cli.js 路径
                        args = [str(npx_cli_js)] + args
                        # 添加阿里镜像源参数（放在 npx-cli.js 后面）
                        args = args[:1] + ["--registry=https://registry.npmmirror.com"] + args[1:]
                        logger.info(f"使用项目自带的 node 执行 npx (阿里镜像源): {command} {' '.join(args)}")
                    else:
                        # 回退到系统命令
                        command = "npx"
                        logger.info(f"使用系统 npx 命令")
                  
                config["command"] = command
                config["args"] = args
            
            # 处理环境变量 - 从环境变量中读取实际的值
            env = {}
            env_key_list = server_config.get("env", [])
            # env 是环境变量名列表，从环境变量中读取值
            for env_key in env_key_list:
                value = settings.env_manager.get_api_key(env_key)
                if value is not None:
                    env[env_key] = value
            config["env"] = env
        elif config["transport"] in ["http", "sse"]:
            # 对于HTTP、SSE传输，都需要url参数
            if server_config.get("url"):
                config["url"] = server_config.get("url")
            
            # 处理请求头
            headers = server_config.get("headers", {}).copy() if server_config.get("headers") else {}
            config["headers"] = headers
        
        langchain_config[server_id] = config

    return langchain_config


def get_all_mcp_servers():
    """
    获取所有MCP服务器配置
    
    Returns:
        Dict[str, Dict]: 所有MCP服务器配置
    """
    return settings.get_config("mcpServers", default={})


async def add_mcp_server(server_id: str, server_config: dict):
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


async def delete_mcp_server(server_id: str):
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
    
    # 删除配置
    del mcp_servers[server_id]
    settings.update_config(mcp_servers, "mcpServers")
    logger.info(f"已删除MCP服务器配置: {server_id}")
    return mcp_servers


async def get_mcp_tools(server_id: str | None = None):
    """
    获取MCP工具并返回工具字典，这个主要返回的是基础信息字典，前端用不上完整的工具对象。
    
    Args:
        server_id: 可选的服务器ID，如果提供则只返回该服务器的工具
    """
    try:
        mcp_servers_config = settings.get_config("mcpServers", default={})
        langchain_config = convert_to_langchain_config(mcp_servers_config)
        
        # 如果指定了服务器ID，只连接该服务器
        if server_id:
            langchain_config = {k: v for k, v in langchain_config.items() if k == server_id}
            if not langchain_config:
                logger.warning(f"服务器 {server_id} 不存在或未激活")
                return {}
        
        logger.info(f"开始获取MCP工具，配置: {langchain_config}")
        client = MultiServerMCPClient(langchain_config)
        McpTools = await client.get_tools()
        logger.info(f"成功获取到 {len(McpTools)} 个MCP工具")
        # 将BaseTool列表转换为可序列化的字典
        tools_dict = {}
        for tool in McpTools:
            tools_dict[tool.name] = {
                "name": tool.name,
                "description": tool.description,
                "inputSchema": getattr(tool, 'args_schema', None)
            }
        return tools_dict
    except ExceptionGroup as eg:
        # 捕获ExceptionGroup（Python 3.11+的TaskGroup错误）
        logger.error(f"获取MCP工具时发生ExceptionGroup，包含 {len(eg.exceptions)} 个异常:")
        for i, exc in enumerate(eg.exceptions, 1):
            # 递归解包嵌套的ExceptionGroup
            if isinstance(exc, ExceptionGroup):
                logger.error(f"  异常 {i} (嵌套ExceptionGroup):")
                for j, sub_exc in enumerate(exc.exceptions, 1):
                    logger.error(f"    子异常 {j}: {type(sub_exc).__name__}: {sub_exc}", exc_info=True)
            else:
                logger.error(f"  异常 {i}: {type(exc).__name__}: {exc}", exc_info=True)
        raise RuntimeError(f"获取MCP工具失败: {len(eg.exceptions)} 个服务器连接失败") from eg
    except Exception as e:
        logger.error(f"获取MCP工具时发生异常: {type(e).__name__}: {e}", exc_info=True)
        raise


async def get_mcp_tools_as_objects(server_id: str | None = None):
    """
    获取MCP工具并返回可调用的工具对象字典。由于内置工具是字典格式，转成字典更好用。
    
    Args:
        server_id: 可选的服务器ID，如果提供则只返回该服务器的工具
    
    Returns:
        Dict[str, Any]: MCP工具对象字典（可调用的BaseTool对象）
    """
    try:
        mcp_servers_config = settings.get_config("mcpServers", default={})
        langchain_config = convert_to_langchain_config(mcp_servers_config)
        
        # 如果指定了服务器ID，只连接该服务器
        if server_id:
            langchain_config = {k: v for k, v in langchain_config.items() if k == server_id}
            if not langchain_config:
                logger.warning(f"服务器 {server_id} 不存在或未激活")
                return {}
        
        logger.info(f"开始获取MCP工具对象，配置: {langchain_config}")
        client = MultiServerMCPClient(langchain_config)
        McpTools = await client.get_tools()
        logger.info(f"成功获取到 {len(McpTools)} 个MCP工具对象")
        # 将BaseTool列表转换为工具对象字典
        tools_dict = {}
        for tool in McpTools:
            tools_dict[tool.name] = tool
        return tools_dict
    except ExceptionGroup as eg:
        # 捕获ExceptionGroup（Python 3.11+的TaskGroup错误）
        logger.error(f"获取MCP工具对象时发生ExceptionGroup，包含 {len(eg.exceptions)} 个异常:")
        for i, exc in enumerate(eg.exceptions, 1):
            # 递归解包嵌套的ExceptionGroup
            if isinstance(exc, ExceptionGroup):
                logger.error(f"  异常 {i} (嵌套ExceptionGroup):")
                for j, sub_exc in enumerate(exc.exceptions, 1):
                    logger.error(f"    子异常 {j}: {type(sub_exc).__name__}: {sub_exc}", exc_info=True)
            else:
                logger.error(f"  异常 {i}: {type(exc).__name__}: {exc}", exc_info=True)
        raise RuntimeError(f"获取MCP工具对象失败: {len(eg.exceptions)} 个服务器连接失败") from eg
    except Exception as e:
        logger.error(f"获取MCP工具对象时发生异常: {type(e).__name__}: {e}", exc_info=True)
        raise


async def get_all_mcp_tools_by_server():
    """
    获取所有活跃MCP服务器的工具，按服务器ID组织
    
    Returns:
        Dict[str, Dict]: 按服务器ID组织的工具字典
        {
            "server_id_1": {
                "tools": {...},
                "error": null
            },
            "server_id_2": {
                "tools": {...},
                "error": "错误信息"
            }
        }
    """
    mcp_servers_config = settings.get_config("mcpServers", default={})
    langchain_config = convert_to_langchain_config(mcp_servers_config)
    
    # 只处理活跃的服务器
    active_server_ids = list(langchain_config.keys())
    if not active_server_ids:
        return {}
    
    result = {}
    
    # 逐个获取每个服务器的工具
    for server_id in active_server_ids:
        try:
            logger.info(f"开始获取服务器 {server_id} 的工具")
            server_config = {server_id: langchain_config[server_id]}
            client = MultiServerMCPClient(server_config)
            tools = await client.get_tools()
            
            # 将工具转换为可序列化的字典
            tools_dict = {}
            for tool in tools:
                tools_dict[tool.name] = {
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": getattr(tool, 'args_schema', None)
                }
            
            result[server_id] = {
                "tools": tools_dict,
                "error": None
            }
            logger.info(f"成功获取服务器 {server_id} 的 {len(tools_dict)} 个工具")
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            logger.error(f"获取服务器 {server_id} 的工具失败: {error_msg}", exc_info=True)
            # 继续处理其他服务器，不中断整个流程
            result[server_id] = {
                "tools": {},
                "error": error_msg,
                "server_name": mcp_servers_config.get(server_id, {}).get("name", server_id)
            }
    
    return result
