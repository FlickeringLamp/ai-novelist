"""MCP工具适配器，将MCP工具转换为项目可用的工具格式"""
import asyncio
from typing import Dict, Any, Callable, Optional
from .mcp_client import MCPClient


class MCPToolAdapter:
    """MCP工具适配器"""
    
    def __init__(self, mcp_client: MCPClient):
        self.mcp_client = mcp_client
        self.adapted_tools: Dict[str, Callable] = {}
    
    def adapt_tools(self) -> Dict[str, Callable]:
        """将所有MCP工具适配为可调用的工具函数"""
        self.adapted_tools.clear()
        
        all_tools = self.mcp_client.get_all_tools()
        
        for server_name, tools in all_tools.items():
            for tool in tools:
                tool_name = tool.get("name")
                if not tool_name:
                    continue
                
                # 创建工具函数
                adapted_tool = self._create_adapted_tool(server_name, tool)
                
                # 使用服务器名称作为前缀，避免工具名称冲突
                prefixed_name = f"{server_name}_{tool_name}"
                self.adapted_tools[prefixed_name] = adapted_tool
                
                print(f"[OK] 已适配工具: {prefixed_name}")
        
        return self.adapted_tools
    
    def _create_adapted_tool(self, server_name: str, tool: Dict[str, Any]) -> Callable:
        """创建适配后的工具函数"""
        tool_name = tool.get("name")
        description = tool.get("description", "")
        input_schema = tool.get("inputSchema", {})
        
        def adapted_tool(**kwargs):
            """适配后的工具函数"""
            try:
                # 在异步上下文中调用MCP工具
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # 如果事件循环正在运行，创建任务
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(
                            asyncio.run,
                            self.mcp_client.call_tool(server_name, tool_name, kwargs)
                        )
                        result = future.result()
                else:
                    # 如果事件循环未运行，直接运行
                    result = asyncio.run(self.mcp_client.call_tool(server_name, tool_name, kwargs))
                
                return result
            except Exception as e:
                print(f"[ERROR] 调用MCP工具失败: {server_name}.{tool_name}, {str(e)}")
                return {"error": str(e)}
        
        # 设置工具函数的元数据
        adapted_tool.__name__ = f"{server_name}_{tool_name}"
        adapted_tool.__doc__ = description
        adapted_tool._mcp_tool = True
        adapted_tool._server_name = server_name
        adapted_tool._tool_name = tool_name
        adapted_tool._input_schema = input_schema
        
        return adapted_tool
    
    def get_tool_info(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """获取工具的详细信息"""
        if tool_name not in self.adapted_tools:
            return None
        
        tool_func = self.adapted_tools[tool_name]
        
        return {
            "name": tool_name,
            "description": tool_func.__doc__,
            "server_name": getattr(tool_func, "_server_name", ""),
            "tool_name": getattr(tool_func, "_tool_name", ""),
            "input_schema": getattr(tool_func, "_input_schema", {})
        }
    
    def get_all_tool_info(self) -> Dict[str, Dict[str, Any]]:
        """获取所有工具的详细信息"""
        return {
            tool_name: self.get_tool_info(tool_name)
            for tool_name in self.adapted_tools
        }
    
    def get_adapted_tools(self) -> Dict[str, Callable]:
        """获取适配后的工具字典"""
        return self.adapted_tools
