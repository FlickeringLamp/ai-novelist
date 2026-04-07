import subprocess
import asyncio
from pathlib import Path
from typing import Optional
import logging
from backend.settings.settings import settings

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
                return ""
            
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
            
            # 使用 run_in_executor 包装同步 subprocess，避免 Windows 上 asyncio subprocess 的问题
            def run_rg():
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='ignore'
                )
                return result
            
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, run_rg)
            
            if result.returncode != 0:
                if "No matches found" in result.stderr or result.returncode == 1:
                    return ""
                else:
                    logger.error(f"ripgrep 搜索失败: {result.stderr}")
                    return ""
            
            # 直接返回原始输出，不进行解析
            output = result.stdout
            return output
            
        except FileNotFoundError as e:
            logger.error(f"ripgrep 未找到: {e}")
            return ""
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return ""


ripgrep_service = RipgrepSearchService()
