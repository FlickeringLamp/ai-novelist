"""基于Git的检查点服务，用于管理文件归档。"""

import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from git import Repo, GitCommandError

from backend.config.config import settings

logger = logging.getLogger(__name__)


class CheckpointService:
    """用于管理基于Git的文件检查点的服务。"""

    def __init__(self):
        """
        初始化检查点服务。
        """
        self.repo = Repo(Path(settings.DATA_DIR))

    def save_checkpoint(self, message: Optional[str] = None) -> Dict[str, Any]:
        """
        将当前状态保存为检查点。

        Args:
            message: 可选的检查点消息，默认为自动生成的消息。

        Returns:
            包含检查点信息的字典。
        """
        try:
            repo = self.repo

            # 如果未提供消息，则生成消息
            if message is None:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                message = f"Checkpoint: {timestamp}"

            # 添加所有文件（包括未跟踪的文件）
            # 使用 git add -A 来添加所有更改，包括删除的文件
            repo.git.add("-A")

            # 检查是否有更改需要提交
            if repo.is_dirty(untracked_files=False):
                # 创建提交
                commit = repo.index.commit(message)

                logger.info(f"Created checkpoint: {commit.hexsha[:8]} - {message}")

                return {
                    "success": True,
                    "commit_hash": commit.hexsha,
                    "short_hash": commit.hexsha[:8],
                    "message": message,
                }
            else:
                logger.info("没有更改需要提交")
                return {
                    "success": False,
                    "message": "没有更改需要提交",
                }

        except GitCommandError as e:
            logger.error(f"保存检查点失败: {e}")
            return {
                "success": False,
                "message": f"保存检查点失败: {str(e)}",
            }

    def list_checkpoints(self) -> List[Dict[str, Any]]:
        """
        列出所有检查点。

        Returns:
            检查点信息字典列表。
        """
        try:
            repo = self.repo
            checkpoints = []

            # 获取提交历史
            for commit in repo.iter_commits():
                checkpoints.append(
                    {
                        "commit_hash": commit.hexsha,
                        "short_hash": commit.hexsha[:8],
                        "message": commit.message.strip(),
                    }
                )

            return checkpoints

        except GitCommandError as e:
            logger.error(f"列出检查点失败: {e}")
            return []

    def restore_checkpoint(self, commit_hash: str) -> Dict[str, Any]:
        """
        将工作区恢复到指定的检查点。

        Args:
            commit_hash: 要恢复的提交哈希。

        Returns:
            包含恢复结果的字典。
        """
        try:
            repo = self.repo

            # 获取提交
            commit = repo.commit(commit_hash)

            # 重置到该提交
            repo.git.reset("--hard", commit_hash)

            # 清理未跟踪的文件
            repo.git.clean("-fd")

            logger.info(f"Restored to checkpoint: {commit_hash[:8]}")

            return {
                "success": True,
                "commit_hash": commit.hexsha,
                "short_hash": commit.hexsha[:8],
                "message": commit.message.strip(),
            }

        except GitCommandError as e:
            logger.error(f"恢复检查点失败: {e}")
            return {
                "success": False,
                "message": f"恢复检查点失败: {str(e)}",
            }

    def get_checkpoint_diff(self, commit_hash: str) -> Dict[str, Any]:
        """
        获取检查点与其父提交之间的差异。

        Args:
            commit_hash: 要比较的提交哈希。

        Returns:
            包含差异信息的字典，包括详细的diff内容。
        """
        try:
            repo = self.repo

            # 获取提交
            commit = repo.commit(commit_hash)

            # 获取父提交
            parents = list(commit.parents)

            # 如果没有父提交（初始提交），返回空差异
            if not parents:
                return {
                    "success": True,
                    "commit_hash": commit_hash,
                    "short_hash": commit_hash[:8],
                    "changes": [],
                    "is_initial_commit": True,
                }

            # 获取与父提交的差异（使用 raw 模式）
            parent_commit = parents[0]
            diff = parent_commit.diff(commit) # 看起来父.diff(子)，才能计算出后者相较于前者的变更。

            changes = []
            for item in diff:
                # 根据变更类型选择正确的路径
                if item.change_type == 'A':  # 新增的文件
                    file_path = item.b_path
                elif item.change_type == 'D':  # 删除的文件
                    file_path = item.a_path
                else:  # 修改的文件或其他
                    file_path = item.b_path if item.b_path else item.a_path

                change_info = {
                    "path": file_path,
                    "change_type": item.change_type,
                }

                # 根据变更类型获取文件内容
                if item.change_type == 'M':  # 修改的文件
                    # 获取旧文件内容（父提交中的版本）
                    if item.a_blob:
                        change_info["old_content"] = item.a_blob.data_stream.read().decode('utf-8', errors='replace')
                    # 获取新文件内容（当前提交中的版本）
                    if item.b_blob:
                        change_info["new_content"] = item.b_blob.data_stream.read().decode('utf-8', errors='replace')
                elif item.change_type == 'A':  # 新增的文件
                    # 新文件只有新内容
                    if item.b_blob:
                        change_info["new_content"] = item.b_blob.data_stream.read().decode('utf-8', errors='replace')
                    change_info["old_content"] = ""
                elif item.change_type == 'D':  # 删除的文件
                    # 删除的文件只有旧内容
                    if item.a_blob:
                        change_info["old_content"] = item.a_blob.data_stream.read().decode('utf-8', errors='replace')
                    change_info["new_content"] = ""

                changes.append(change_info)

            return {
                "success": True,
                "commit_hash": commit_hash,
                "short_hash": commit_hash[:8],
                "changes": changes,
            }

        except GitCommandError as e:
            logger.error(f"获取差异失败: {e}")
            return {
                "success": False,
                "message": f"获取差异失败: {str(e)}",
            }


    def get_status(self) -> Dict[str, Any]:
        """
        获取当前Git状态。

        Returns:
            包含状态信息的字典。
        """
        try:
            repo = self.repo

            # 获取修改的文件
            modified_files = [item.a_path for item in repo.index.diff(None)]

            # 判断是否有更改
            dirty = repo.is_dirty(untracked_files=True)

            return {
                "branch": repo.active_branch.name,
                "dirty": dirty,
                "untracked_files": repo.untracked_files,
                "modified_files": modified_files,
            }

        except GitCommandError as e:
            logger.error(f"获取状态失败: {e}")
            return {
                "initialized": False,
                "error": str(e),
            }


# 全局检查点服务实例
_checkpoint_service: Optional[CheckpointService] = None


def get_checkpoint_service() -> CheckpointService:
    """获取全局检查点服务实例。"""
    global _checkpoint_service
    if _checkpoint_service is None:
        _checkpoint_service = CheckpointService()
    return _checkpoint_service
