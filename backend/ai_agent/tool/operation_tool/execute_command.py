"""
execute_command 工具
让 AI 能够执行任意命令行命令
"""

import os
import asyncio
from pathlib import Path
from typing import Optional, Dict
from pydantic import BaseModel, Field
from langchain.tools import tool

from backend.settings.settings import settings


class ExecuteCommandInput(BaseModel):
    command: str = Field(description="要执行的命令字符串（例如 'ls -la'）")
    cwd: Optional[str] = Field(default=None, description="工作目录路径（可选），默认为 data 目录")
    timeout: Optional[int] = Field(default=30, description="超时时间（秒），默认为30")


async def run_command(
    command: str,
    cwd: Optional[str] = None,
    timeout: int = 30,
) -> str:
    """执行命令行命令并返回输出
    
    Args:
        command: 命令字符串
        cwd: 工作目录路径（可选）
        timeout: 超时时间（秒）
        env_overrides: 环境变量覆盖（可选）
        
    Returns:
        命令输出（stdout + stderr）
        
    Raises:
        RuntimeError: 命令执行失败或超时
    """
    # 设置工作目录 - 默认为 data 目录
    if cwd:
        cwd_path = Path(cwd).expanduser().resolve()
        if not cwd_path.exists():
            raise RuntimeError(f"工作目录不存在: {cwd}")
        cwd_str = str(cwd_path)
    else:
        # 默认使用 data 目录
        cwd_str = settings.DATA_DIR
    
    # 准备环境变量
    env = os.environ.copy()
    
    # 执行命令（使用 shell 以支持管道、重定向等）
    try:
        process = await asyncio.wait_for(
            asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd_str,
                env=env
            ),
            timeout=timeout
        )
        
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout
        )
        
        # 合并输出
        output = ""
        if stdout:
            output += stdout.decode('utf-8', errors='ignore')
        if stderr:
            output += stderr.decode('utf-8', errors='ignore')
        
        # 检查返回码
        if process.returncode != 0:
            raise RuntimeError(f"命令执行失败 (退出码: {process.returncode}): {output}")
        
        return output
        
    except asyncio.TimeoutError:
        # 超时，尝试终止进程
        if 'process' in locals():
            try:
                process.kill()
                await process.wait()
            except:
                pass
        raise RuntimeError(f"命令执行超时（{timeout}秒）")
    except Exception as e:
        raise RuntimeError(f"命令执行出错: {str(e)}")


@tool(args_schema=ExecuteCommandInput)
async def execute_command(command: str, cwd: Optional[str] = None, timeout: int = 30) -> str:
    """
执行任意命令行命令

示例：
    - ls -la
    - python3 script.py
    - node index.js
    """
    try:
        result = await run_command(command, cwd, timeout)
        return f"【工具结果】：执行成功\n{result}"
    except Exception as e:
        return f"【工具结果】：执行失败 - {str(e)}"
