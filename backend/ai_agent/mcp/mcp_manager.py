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


async def get_mcp_data() -> dict:
    """
    获取完整的MCP数据
    
    Returns:
        Dict: 直接返回 {server_id: {...}} 格式的数据
        {
            "server_id": {
                "name": str,
                "description": str,
                "url": str,
                "isActive": bool,
                "transport": str,
                "command": str,
                "args": list,
                "env": list,
                "headers": dict,
                "envValues": dict
            }
        }
    """
    # 获取基本配置（直接是 {server_id: {...}} 格式）
    config = settings.get_config("mcpServers", default={})
    
    for server_id, server_config in config.items():
        # 添加 envValues（从环境变量读取）
        env_keys = server_config.get("env", [])
        env_values = {}
        if isinstance(env_keys, list):
            for key in env_keys:
                value = settings.env_manager.get_api_key(key)
                if value is not None:
                    env_values[key] = value
        server_config["envValues"] = env_values
    
    return config


async def get_mcp_server_tools(server_id: str) -> dict:
    """
    获取单个MCP服务器的工具列表
    
    Args:
        server_id: MCP服务器ID
    
    Returns:
        Dict: 包含工具列表的字典
        {
            "tools": list  # 该服务器的工具列表
        }
    """
    config = settings.get_config("mcpServers", default={})
    
    if server_id not in config:
        raise ValueError(f"MCP服务器 {server_id} 不存在")
    
    server_config = config[server_id]
    langchain_config = convert_to_langchain_config({server_id: server_config})
    
    tools_list = []
    try:
        logger.info(f"开始获取服务器 {server_id} 的工具")
        server_conn_config = {server_id: langchain_config[server_id]}
        client = MultiServerMCPClient(server_conn_config)
        tools = await client.get_tools()
        
        # 将工具转换为可序列化的字典列表
        for tool in tools:
            tools_list.append({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": getattr(tool, 'args_schema', None)
            })
        
        logger.info(f"成功获取服务器 {server_id} 的 {len(tools_list)} 个工具")
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        logger.error(f"获取服务器 {server_id} 的工具失败: {error_msg}", exc_info=True)
    
    return {"tools": tools_list}


async def save_mcp_server(server_id: str, server_config: dict) -> dict:
    # 获取现有配置
    config = settings.get_config("mcpServers", default={})
    print("config:",config)
    print("server_config",server_config)
    # 创建新配置副本，剔除动态字段
    new_config = {k: v for k, v in server_config.items() if k not in ("envValues", "tools")}
    print("new_config:",new_config)
    # 处理 envValues - 保存到环境变量（如果有的话）
    if "envValues" in server_config:
        env_values = server_config["envValues"]
        for key, value in env_values.items():
            settings.env_manager.set_api_key(key, value)
    
    # 直接替换旧配置
    config[server_id] = new_config
    
    # 持久化保存
    settings.update_config(config, "mcpServers")

    return await get_mcp_data()


async def delete_mcp_server(server_id: str):
    config = settings.get_config("mcpServers", default={})
    
    if server_id not in config:
        raise ValueError(f"MCP服务器 {server_id} 不存在")
    
    # 删除配置
    del config[server_id]
    
    # 持久化保存
    settings.update_config(config, "mcpServers")
    
    logger.info(f"已删除MCP服务器配置: {server_id}")
    return await get_mcp_data()


async def get_mcp_tools_as_objects(server_id: str | None = None):
    """
    获取MCP工具并返回可调用的工具对象字典。用于AI Agent调用工具。
    工具名称会添加前缀: mcp--<server_name>--<tool_name>
    
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
        
        # 逐个服务器获取工具，以便添加正确的命名空间前缀
        tools_dict = {}
        for srv_id, srv_config in langchain_config.items():
            try:
                single_client = MultiServerMCPClient({srv_id: srv_config})
                server_tools = await single_client.get_tools()
                
                # 从原始配置中获取服务器名称
                server_name = mcp_servers_config.get(srv_id, {}).get("name", srv_id)
                
                for tool in server_tools:
                    # 添加前缀: mcp--<server_id>--<tool_name>
                    # 使用 server_id 而不是 server_name，避免中文或非ASCII字符导致API报错
                    prefixed_name = f"mcp--{srv_id}--{tool.name}"
                    # 修改工具对象的 name 属性，使其在 bind_tools 时带前缀
                    tool.name = prefixed_name
                    tools_dict[prefixed_name] = tool
                    logger.debug(f"已添加MCP工具: {prefixed_name}")
                
                logger.info(f"服务器 {srv_id} 提供了 {len(server_tools)} 个工具")
                # 注意：langchain-mcp-adapters 0.1.0+ 不再支持上下文管理器模式
                # 也不需要手动调用__aexit__清理方法
            except Exception as srv_e:
                logger.error(f"获取服务器 {srv_id} 的工具失败: {type(srv_e).__name__}: {srv_e}")
                # 继续处理其他服务器
        
        logger.info(f"成功获取到总共 {len(tools_dict)} 个MCP工具对象")
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
