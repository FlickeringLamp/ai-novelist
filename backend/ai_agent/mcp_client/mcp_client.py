"""MCP客户端核心实现"""
import asyncio
import json
import subprocess
from typing import Dict, List, Any, Optional
from pydantic import BaseModel


class MCPServerConfig(BaseModel):
    """MCP服务器配置"""
    name: str
    command: str  # 启动命令
    args: List[str] = []  # 命令参数
    transport: str = "stdio"  # 传输方式: stdio 或 sse


class MCPClient:
    """MCP客户端，用于连接和管理MCP服务器"""
    
    def __init__(self):
        self.servers: Dict[str, MCPServerConfig] = {}
        self.processes: Dict[str, subprocess.Popen] = {}
        self.server_tools: Dict[str, List[Dict[str, Any]]] = {}
        self.request_id = 0
    
    def add_server(self, config: MCPServerConfig):
        """添加MCP服务器配置"""
        self.servers[config.name] = config
        print(f"[INFO] 已添加MCP服务器配置: {config.name}")
    
    def remove_server(self, name: str):
        """移除MCP服务器"""
        if name in self.servers:
            del self.servers[name]
            if name in self.processes:
                self.processes[name].terminate()
                del self.processes[name]
            if name in self.server_tools:
                del self.server_tools[name]
            print(f"[INFO] 已移除MCP服务器: {name}")
    
    async def connect_server(self, name: str) -> bool:
        """连接到指定的MCP服务器"""
        if name not in self.servers:
            print(f"[ERROR] 未找到服务器配置: {name}")
            return False
        
        if name in self.processes:
            print(f"[INFO] 服务器 {name} 已连接")
            return True
        
        config = self.servers[name]
        
        try:
            if config.transport == "stdio":
                process = subprocess.Popen(
                    [config.command] + config.args,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=0
                )
                self.processes[name] = process
                
                # 发送初始化请求
                await self._send_request(name, {
                    "jsonrpc": "2.0",
                    "id": self._next_request_id(),
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {}
                        }
                    }
                })
                
                # 等待响应
                response = await self._read_response(name)
                if response and "result" in response:
                    print(f"[OK] 成功连接到MCP服务器: {name}")
                    
                    # 列出可用工具
                    await self._list_tools(name)
                    return True
                else:
                    print(f"[ERROR] 连接MCP服务器失败: {name}")
                    return False
            else:
                print(f"[ERROR] 不支持的传输方式: {config.transport}")
                return False
                
        except Exception as e:
            print(f"[ERROR] 连接MCP服务器异常: {name}, {str(e)}")
            return False
    
    async def _list_tools(self, server_name: str):
        """列出服务器的所有工具"""
        try:
            response = await self._send_request(server_name, {
                "jsonrpc": "2.0",
                "id": self._next_request_id(),
                "method": "tools/list"
            })
            
            if response and "result" in response:
                tools = response["result"].get("tools", [])
                self.server_tools[server_name] = tools
                print(f"[INFO] 服务器 {server_name} 提供的工具:")
                for tool in tools:
                    print(f"  - {tool.get('name')}: {tool.get('description', '无描述')}")
        except Exception as e:
            print(f"[ERROR] 列出工具失败: {str(e)}")
    
    async def call_tool(self, server_name: str, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """调用MCP服务器的工具"""
        if server_name not in self.processes:
            print(f"[ERROR] 服务器 {server_name} 未连接")
            return None
        
        try:
            response = await self._send_request(server_name, {
                "jsonrpc": "2.0",
                "id": self._next_request_id(),
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            })
            
            if response and "result" in response:
                return response["result"]
            elif response and "error" in response:
                print(f"[ERROR] 工具调用失败: {response['error']}")
                return None
            return None
            
        except Exception as e:
            print(f"[ERROR] 调用工具异常: {str(e)}")
            return None
    
    async def _send_request(self, server_name: str, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """发送请求到MCP服务器"""
        if server_name not in self.processes:
            return None
        
        process = self.processes[server_name]
        
        try:
            # 发送JSON-RPC请求
            request_str = json.dumps(request) + "\n"
            process.stdin.write(request_str)
            process.stdin.flush()
            
            # 读取响应
            return await self._read_response(server_name)
            
        except Exception as e:
            print(f"[ERROR] 发送请求失败: {str(e)}")
            return None
    
    async def _read_response(self, server_name: str) -> Optional[Dict[str, Any]]:
        """读取MCP服务器的响应"""
        if server_name not in self.processes:
            return None
        
        process = self.processes[server_name]
        
        try:
            # 读取一行响应
            line = process.stdout.readline()
            if not line:
                return None
            
            # 解析JSON响应
            response = json.loads(line.strip())
            return response
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] 解析响应失败: {str(e)}")
            return None
        except Exception as e:
            print(f"[ERROR] 读取响应失败: {str(e)}")
            return None
    
    def _next_request_id(self) -> int:
        """生成下一个请求ID"""
        self.request_id += 1
        return self.request_id
    
    def get_all_tools(self) -> Dict[str, List[Dict[str, Any]]]:
        """获取所有服务器的工具"""
        return self.server_tools
    
    def get_tools_for_server(self, server_name: str) -> List[Dict[str, Any]]:
        """获取指定服务器的工具列表"""
        return self.server_tools.get(server_name, [])
    
    async def disconnect_all(self):
        """断开所有服务器连接"""
        for name, process in self.processes.items():
            try:
                process.terminate()
                print(f"[INFO] 已断开服务器: {name}")
            except Exception as e:
                print(f"[ERROR] 断开服务器失败: {name}, {str(e)}")
        
        self.processes.clear()
        self.server_tools.clear()
    
    async def connect_all(self):
        """连接所有配置的服务器"""
        for name in self.servers:
            await self.connect_server(name)
