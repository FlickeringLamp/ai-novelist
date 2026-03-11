import subprocess
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
import re
from backend.config.config import settings

logger = logging.getLogger(__name__)


class RipgrepSearchService:
    
    def __init__(self):
        self.data_dir = Path(settings.DATA_DIR)
    
    async def search(
        self,
        query: str,
        directory: Optional[str] = None,
        file_pattern: Optional[str] = None,
        case_sensitive: bool = False,
        max_results: Optional[int] = None,
        ignore_file: Optional[str] = None
    ) -> str:
        try:
            if directory:
                search_dir = self.data_dir / directory
            else:
                search_dir = self.data_dir
            
            if not search_dir.exists():
                logger.warning(f"搜索目录不存在: {search_dir}")
                return []
            
            cmd = [settings.RG_EXECUTABLE, query, str(search_dir)]
            
            if not case_sensitive:
                cmd.append("-i")
            
            # 显示1行上下文
            cmd.append("-C")
            cmd.append("1")
            
            if file_pattern:
                cmd.append("-g")
                cmd.append(file_pattern)
            
            if max_results:
                cmd.append("--max-count")
                cmd.append(str(max_results))
            
            cmd.append("--line-number")
            cmd.append("--no-heading")
            cmd.append("--color=never")
            
            # 使用传入的 ignore_file 文件过滤
            if ignore_file:
                ignore_path = Path(ignore_file)
                if ignore_path.exists():
                    print(f"传入的ignore文件{ignore_path}")
                    # 禁用 .gitignore 等VCS ignore文件，只使用指定的 ignore_file
                    cmd.append("--no-ignore-vcs")
                    cmd.append("--ignore-file")
                    cmd.append(str(ignore_path))
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                if b"No matches found" in stderr or process.returncode == 1:
                    return ""
                else:
                    logger.error(f"ripgrep 搜索失败: {stderr.decode('utf-8', errors='ignore')}")
                    return ""
            
            # 直接返回原始输出，不进行解析
            output = stdout.decode('utf-8', errors='ignore')
            print(f"结果为{output}")
            return output
            
        except FileNotFoundError:
            logger.error("ripgrep 未安装，请先安装 ripgrep")
            return ""
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return ""


ripgrep_service = RipgrepSearchService()
