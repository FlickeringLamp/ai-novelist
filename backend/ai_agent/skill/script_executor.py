"""
Skill 脚本执行器
负责执行 Skill 的脚本文件
"""

import asyncio
import subprocess
from pathlib import Path
from typing import Optional, Dict

from .env_manager import SkillEnvManager


class SkillScriptExecutor:
    """Skill 脚本执行器"""
    
    def __init__(self):
        self.env_manager = SkillEnvManager()
    
    def _get_script_type(self, script_path: Path) -> str:
        """根据文件扩展名获取脚本类型
        
        Args:
            script_path: 脚本文件路径
            
        Returns:
            脚本类型（python/node/bash）
        """
        suffix = script_path.suffix.lower()
        if suffix == '.py':
            return 'python'
        elif suffix == '.js':
            return 'node'
        elif suffix == '.sh':
            return 'bash'
        else:
            raise ValueError(f"不支持的脚本类型: {suffix}")
    
    async def execute_script(
        self,
        skill_name: str,
        script_path: Path,
        env_overrides: Dict[str, str],
        args: Optional[str] = None,
        timeout: int = 30
    ) -> str:
        """执行 Skill 脚本
        
        Args:
            skill_name: Skill 名称
            script_path: 脚本文件路径
            env_overrides: 环境变量字典
            args: 传递给脚本的参数（可选）
            timeout: 超时时间（秒）
            
        Returns:
            脚本执行结果
            
        Raises:
            RuntimeError: 脚本执行失败
        """
        # 根据文件扩展名获取脚本类型
        script_type = self._get_script_type(script_path)
        
        # 使用环境变量管理器
        with self.env_manager.apply_env_overrides(env_overrides):
            # 根据脚本类型选择解释器
            if script_type == "python":
                cmd = ["python", str(script_path)]
            elif script_type == "node":
                cmd = ["node", str(script_path)]
            elif script_type == "bash":
                cmd = ["bash", str(script_path)]
            else:
                raise ValueError(f"不支持的脚本类型: {script_type}")
            
            # 添加参数
            if args:
                cmd.extend(args.split())
            
            # 执行脚本
            try:
                process = await asyncio.wait_for(
                    asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        cwd=script_path.parent
                    ),
                    timeout=timeout
                )
                
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
                
                if process.returncode != 0:
                    error_msg = stderr.decode('utf-8', errors='ignore')
                    raise RuntimeError(f"脚本执行失败 (退出码: {process.returncode}): {error_msg}")
                
                return stdout.decode('utf-8', errors='ignore')
                
            except asyncio.TimeoutError:
                # 超时，尝试终止进程
                if 'process' in locals():
                    try:
                        process.kill()
                        await process.wait()
                    except:
                        pass
                raise RuntimeError(f"脚本执行超时（{timeout}秒）")
