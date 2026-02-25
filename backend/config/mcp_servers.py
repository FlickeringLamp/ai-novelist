"""MCP服务器配置管理"""
from typing import Dict, List, Any


# 默认MCP服务器配置示例
DEFAULT_MCP_SERVERS = {
    "filesystem": {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "e:/ai-novelist"],
        "transport": "stdio",
        "enabled": True,
        "description": "文件系统访问工具"
    },
    "brave-search": {
        "name": "brave-search",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "transport": "stdio",
        "enabled": False,
        "description": "Brave搜索引擎工具"
    },
    "git": {
        "name": "git",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "e:/ai-novelist"],
        "transport": "stdio",
        "enabled": False,
        "description": "Git版本控制工具"
    }
}


class MCPServerConfigManager:
    """MCP服务器配置管理器"""
    
    def __init__(self, settings):
        self.settings = settings
    
    def get_all_servers(self) -> Dict[str, Dict[str, Any]]:
        """获取所有MCP服务器配置"""
        servers = self.settings.get_config("mcp_servers", default=DEFAULT_MCP_SERVERS)
        return servers
    
    def get_server(self, name: str) -> Dict[str, Any]:
        """获取指定服务器的配置"""
        servers = self.get_all_servers()
        return servers.get(name, {})
    
    def get_enabled_servers(self) -> Dict[str, Dict[str, Any]]:
        """获取所有启用的服务器"""
        servers = self.get_all_servers()
        return {
            name: config 
            for name, config in servers.items() 
            if config.get("enabled", False)
        }
    
    def add_server(self, name: str, config: Dict[str, Any]):
        """添加或更新MCP服务器配置"""
        servers = self.get_all_servers()
        servers[name] = config
        self.settings.update_config("mcp_servers", servers)
    
    def remove_server(self, name: str):
        """移除MCP服务器配置"""
        servers = self.get_all_servers()
        if name in servers:
            del servers[name]
            self.settings.update_config("mcp_servers", servers)
    
    def enable_server(self, name: str):
        """启用MCP服务器"""
        servers = self.get_all_servers()
        if name in servers:
            servers[name]["enabled"] = True
            self.settings.update_config("mcp_servers", servers)
    
    def disable_server(self, name: str):
        """禁用MCP服务器"""
        servers = self.get_all_servers()
        if name in servers:
            servers[name]["enabled"] = False
            self.settings.update_config("mcp_servers", servers)
    
    def update_server(self, name: str, config: Dict[str, Any]):
        """更新MCP服务器配置"""
        servers = self.get_all_servers()
        if name in servers:
            servers[name].update(config)
            self.settings.update_config("mcp_servers", servers)
    
    def get_server_list(self) -> List[Dict[str, Any]]:
        """获取服务器列表（用于前端显示）"""
        servers = self.get_all_servers()
        return [
            {
                "name": name,
                "command": config.get("command", ""),
                "args": config.get("args", []),
                "transport": config.get("transport", "stdio"),
                "enabled": config.get("enabled", False),
                "description": config.get("description", "")
            }
            for name, config in servers.items()
        ]
