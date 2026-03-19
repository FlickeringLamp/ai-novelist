"""
execute_command 工具
让 AI 能够执行任意命令行命令
支持 skills/ 开头的技能命令
"""

import os
import asyncio
import re
from pathlib import Path
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from langchain.tools import tool

from backend.ai_agent.skill.skill_manager import get_skill_loader
from backend.config.config import settings, get_data_dir


class ExecuteCommandInput(BaseModel):
    command: str = Field(description="要执行的命令字符串（例如 'ls -la'）")
    cwd: Optional[str] = Field(default=None, description="工作目录路径（可选），默认为 data 目录")
    timeout: Optional[int] = Field(default=30, description="超时时间（秒），默认为30")


def is_skill_command(command: str) -> bool:
    """检查命令是否是技能命令
    
    Args:
        command: 命令字符串
        
    Returns:
        如果是 skills/ 开头的命令则返回 True
    """
    # 检查命令是否包含 skills/ 路径
    pattern = r'skills/[^/\s]+'
    return bool(re.search(pattern, command))


def parse_skill_command(command: str) -> tuple[str, str, str]:
    """解析技能命令，提取技能名称和剩余路径
    
    Args:
        command: 技能命令字符串，如 "python3 skills/baidu-search/scripts/search.py '{}'"
        
    Returns:
        (skill_name, skill_path, remaining_command)
        skill_name: 技能名称，如 "baidu-search"
        skill_path: 技能路径部分，如 "skills/baidu-search"
        remaining_command: 替换后的命令
    """
    # 匹配 skills/[skill_name] 模式
    pattern = r'skills/([^/\s]+)'
    match = re.search(pattern, command)
    if not match:
        raise ValueError(f"无法解析技能命令: {command}")
    
    skill_name = match.group(1)
    skill_path = match.group(0)  # "skills/baidu-search"
    
    return skill_name, skill_path, command


def get_skill_env(skill_name: str) -> Dict[str, str]:
    """获取技能的环境变量配置
    
    Args:
        skill_name: 技能名称
        
    Returns:
        环境变量字典
    """
    skill_config = settings.get_config(skill_name, default={}, config_file="skills_config.yaml")
    env = skill_config.get("env", {})
    return env.copy()


async def run_command(
    command: str,
    cwd: Optional[str] = None,
    timeout: int = 30,
    env_overrides: Optional[Dict[str, str]] = None
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
        cwd_str = str(get_data_dir())
    
    # 准备环境变量
    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)
    
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


async def handle_skill_command(command: str) -> tuple[str, Dict[str, str]]:
    """处理技能命令，返回处理后的命令和环境变量
    
    Args:
        command: 原始命令
        
    Returns:
        (processed_command, env_overrides)
    """
    # 解析技能命令
    skill_name, skill_path, original_command = parse_skill_command(command)
    
    # 获取技能加载器
    skill_loader = get_skill_loader()
    all_skills = skill_loader.load_all_skills()
    
    # 查找技能对象
    skill = all_skills.get(skill_name)    
    if not skill:
        raise ValueError(f"技能 '{skill_name}' 不存在")
    
    # 获取技能的基础目录
    base_dir = skill.base_dir
    if not base_dir.exists():
        raise ValueError(f"技能目录不存在: {base_dir}")
    
    # 替换命令中的技能路径
    # 将 "skills/baidu-search" 替换为实际的技能目录路径
    processed_command = original_command.replace(skill_path, str(base_dir))
    
    # 获取技能的环境变量
    env_overrides = get_skill_env(skill_name)
    
    return processed_command, env_overrides


@tool(args_schema=ExecuteCommandInput)
async def execute_command(command: str, cwd: Optional[str] = None, timeout: int = 30) -> str:
    """
执行任意命令行命令，包括skills文件里的命令，
例如：python3 skills/baidu-search/scripts/search.py '<JSON>'
    """
    try:
        # 检查是否是技能命令
        if is_skill_command(command):
            # 处理技能命令
            processed_command, env_overrides = await handle_skill_command(command)
            result = await run_command(processed_command, cwd, timeout, env_overrides)
            return f"【工具结果】：技能命令执行成功\n{result}"
        else:
            # 普通命令
            result = await run_command(command, cwd, timeout)
            return f"【工具结果】：执行成功\n{result}"
    except Exception as e:
        return f"【工具结果】：执行失败 - {str(e)}"