import os
import subprocess
import logging
import shutil
from pathlib import Path
from typing import Dict, List
from backend.config.config import settings

logger = logging.getLogger(__name__)


class MCPInstaller:
    """MCP服务器安装器"""
    
    def __init__(self):
        self.mcp_servers_dir = Path(settings.MCP_SERVERS_DIR)
        self.mcp_servers_dir.mkdir(parents=True, exist_ok=True)
    
    async def install_mcp_server(self, server_id: str, command: str, args: List[str], env: Dict[str, str] = None) -> Dict[str, str]:
        """
        安装MCP服务器
        
        Args:
            server_id: 服务器ID
            command: 命令（如 uvx, npx）
            args: 命令参数，第一个参数是包名
            env: 环境变量
            
        Returns:
            安装结果字典
        """
        result = {
            "status": "success",
            "message": "",
            "install_path": "",
            "command": command,
            "args": args
        }
        
        try:
            # 获取包名（args的第一个元素）
            if not args:
                result["status"] = "skipped"
                result["message"] = f"没有提供包名，跳过安装"
                logger.info(result["message"])
                return result
            
            package_name = args[0]
            logger.info(f"检测到包: {package_name}, 命令: {command}")
            
            # 为该服务器创建独立目录
            server_dir = self.mcp_servers_dir / server_id
            server_dir.mkdir(parents=True, exist_ok=True)
            
            # 根据命令类型选择安装方式
            if command == 'uvx':
                # 使用uv tool install安装Python包，通过环境变量指定安装目录和镜像源
                env = env or {}
                env['UV_TOOL_DIR'] = str(server_dir)
                env['UV_INDEX_URL'] = 'https://mirrors.aliyun.com/pypi/simple/'
                install_cmd = [settings.UV_EXECUTABLE, 'tool', 'install', '--force', package_name]
            elif command == 'npx':
                # 使用npm install安装Node.js包
                install_cmd = ['npm', 'install', '--prefix', str(server_dir), package_name]
            else:
                result["status"] = "skipped"
                result["message"] = f"不支持的命令: {command}，跳过安装"
                logger.info(result["message"])
                return result
            
            logger.info(f"执行安装命令: {' '.join(install_cmd)}")
            
            # 合并环境变量
            process_env = os.environ.copy()
            if env:
                process_env.update(env)
            
            process = subprocess.Popen(
                install_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=process_env
            )
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                result["status"] = "error"
                result["message"] = f"安装失败: {stderr}"
                logger.error(f"安装MCP服务器失败: {stderr}")
                return result
            
            logger.info(f"成功安装MCP服务器: {stdout}")
            
            result["install_path"] = str(server_dir)
            result["message"] = f"成功安装MCP服务器 {package_name}"
            
            return result
            
        except Exception as e:
            result["status"] = "error"
            result["message"] = f"安装过程中发生异常: {str(e)}"
            logger.error(f"安装MCP服务器异常: {e}", exc_info=True)
            return result
    
    async def uninstall_mcp_server(self, server_id: str) -> bool:
        """
        卸载MCP服务器
        
        Args:
            server_id: 服务器ID
            
        Returns:
            是否成功
        """
        try:
            server_dir = self.mcp_servers_dir / server_id
            
            # 从配置文件读取服务器信息
            mcp_servers = settings.get_config("mcpServers", default={})
            server_config = mcp_servers.get(server_id)
            
            if server_config:
                command = server_config.get("command")
                args = server_config.get("args", [])
                
                if command and args:
                    package_name = args[0]
                    
                    # 根据命令类型选择卸载方式
                    if command == 'uvx':
                        uninstall_cmd = [settings.UV_EXECUTABLE, 'tool', 'uninstall', package_name]
                    elif command == 'npx':
                        # npm包直接删除目录即可
                        uninstall_cmd = None
                    else:
                        uninstall_cmd = None
                    
                    if uninstall_cmd:
                        logger.info(f"执行卸载命令: {' '.join(uninstall_cmd)}")
                        
                        process = subprocess.Popen(
                            uninstall_cmd,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            text=True
                        )
                        
                        stdout, stderr = process.communicate()
                        
                        if process.returncode != 0:
                            logger.warning(f"卸载MCP服务器失败: {stderr}")
                        else:
                            logger.info(f"成功卸载MCP服务器: {stdout}")
            
            # 删除服务器目录
            if server_dir.exists():
                shutil.rmtree(server_dir)
                logger.info(f"成功删除MCP服务器目录: {server_id}")
                return True
            
            return False
        except Exception as e:
            logger.error(f"卸载MCP服务器失败: {e}", exc_info=True)
            return False

# 全局安装器实例
mcp_installer = MCPInstaller()
