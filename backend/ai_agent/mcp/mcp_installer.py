import os
import subprocess
import logging
import shutil
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from backend.config.config import settings

logger = logging.getLogger(__name__)


class MCPInstaller:
    """MCP服务器安装器"""
    
    def __init__(self):
        self.mcp_servers_dir = Path(settings.MCP_SERVERS_DIR)
        self.mcp_servers_dir.mkdir(parents=True, exist_ok=True)
    
    def _build_install_command(self, command: str, package_name: str, server_dir: Path) -> Tuple[List[str], Optional[Dict[str, str]]]:
        """
        构建安装命令
        
        Args:
            command: 命令类型 (uvx, npx)
            package_name: 包名
            server_dir: 服务器目录
            
        Returns:
            (命令列表, 环境变量字典)
        """
        if command == 'uvx':
            # 使用uv tool install安装Python包
            env = {
                'UV_TOOL_DIR': str(server_dir),
                'UV_INDEX_URL': 'https://mirrors.aliyun.com/pypi/simple/'
            }
            cmd = [settings.UV_EXECUTABLE, 'tool', 'install', '--force', package_name]
            return cmd, env
        elif command == 'npx':
            # npx不需要预先安装，直接使用npx运行
            # 返回空命令列表表示跳过安装
            return [], None
        else:
            raise ValueError(f"不支持的命令: {command}")
    
    def _build_uninstall_command(self, command: str, package_name: str, server_dir: Path) -> List[str]:
        """
        构建卸载命令
        
        Args:
            command: 命令类型 (uvx, npx)
            package_name: 包名
            server_dir: 服务器目录
            
        Returns:
            命令列表
        """
        if command == 'uvx':
            return [settings.UV_EXECUTABLE, 'tool', 'uninstall', package_name]
        elif command == 'npx':
            # npx不需要卸载，直接删除缓存目录即可
            return []
        else:
            raise ValueError(f"不支持的命令: {command}")
    
    def _execute_command(self, cmd: List[str], env: Optional[Dict[str, str]] = None) -> Tuple[int, str, str]:
        """
        执行命令
        
        Args:
            cmd: 命令列表
            env: 环境变量
            
        Returns:
            (返回码, 标准输出, 标准错误)
        """
        # 合并环境变量
        process_env = os.environ.copy()
        if env:
            process_env.update(env)
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=process_env
        )
        stdout, stderr = process.communicate()
        return process.returncode, stdout, stderr
    
    async def install_mcp_server(self, server_id: str, command: str, args: List[str], env: Dict[str, str] = None) -> Dict[str, str]:
        """
        安装MCP服务器
        
        Args:
            server_id: 服务器ID
            command: 命令（如 uv, npm）
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
            
            # 构建安装命令
            try:
                install_cmd, cmd_env = self._build_install_command(command, package_name, server_dir)
            except ValueError as e:
                result["status"] = "skipped"
                result["message"] = str(e)
                logger.info(result["message"])
                return result
            
            # 如果安装命令为空（如npx），跳过安装
            if not install_cmd:
                result["status"] = "skipped"
                result["message"] = f"{command} 不需要预先安装，将在运行时使用"
                logger.info(result["message"])
                return result
            
            logger.info(f"执行安装命令: {' '.join(install_cmd)}")
            
            # 执行安装命令
            returncode, stdout, stderr = self._execute_command(install_cmd, cmd_env)
            
            if returncode != 0:
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
    
    async def is_mcp_server_installed(self, server_id: str) -> bool:
        """
        检查MCP服务器是否已安装
        
        Args:
            server_id: 服务器ID
            
        Returns:
            是否已安装
        """
        try:
            server_dir = self.mcp_servers_dir / server_id
            
            # 从配置文件读取服务器信息
            mcp_servers = settings.get_config("mcpServers", default={})
            server_config = mcp_servers.get(server_id)
            
            if not server_config:
                return False
            
            command = server_config.get("command")
            args = server_config.get("args", [])
            
            if not command or not args:
                return False
            
            package_name = args[0]
            
            # 检查命令类型
            if command == 'uvx':
                # 检查uv tool list中是否包含该包
                env = {
                    'UV_TOOL_DIR': str(server_dir),
                    'UV_INDEX_URL': 'https://mirrors.aliyun.com/pypi/simple/'
                }
                cmd = [settings.UV_EXECUTABLE, 'tool', 'list']
                returncode, stdout, stderr = self._execute_command(cmd, env)
                
                if returncode == 0 and package_name in stdout:
                    return True
                return False
            elif command == 'npx':
                # npx不需要预先安装，总是返回True
                return True
            
            return False
        except Exception as e:
            logger.error(f"检查MCP服务器安装状态失败: {e}", exc_info=True)
            return False

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
                    
                    # 构建并执行卸载命令
                    try:
                        uninstall_cmd = self._build_uninstall_command(command, package_name, server_dir)
                        
                        # 如果卸载命令不为空，执行卸载
                        if uninstall_cmd:
                            logger.info(f"执行卸载命令: {' '.join(uninstall_cmd)}")
                            
                            returncode, stdout, stderr = self._execute_command(uninstall_cmd)
                            
                            if returncode != 0:
                                logger.warning(f"卸载{command}包失败: {stderr}")
                            else:
                                logger.info(f"成功卸载{command}包: {stdout}")
                        else:
                            logger.info(f"{command} 不需要执行卸载命令，直接删除目录")
                    except ValueError as e:
                        logger.info(f"未知命令类型 {command}，直接删除目录: {e}")
            
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
