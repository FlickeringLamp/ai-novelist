import os
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class FileTreeConfig:
    """文件树配置"""
    max_items: int = 100           # 最大条目数阈值
    min_depth: int = 1             # 最小保留深度（至少保留几层）


@dataclass
class FileTreeResult:
    """文件树结果，包含统计信息"""
    tree: List[Dict]               # 树结构
    level_desc: str                # 层级描述
    total_files: int               # 总文件数
    total_folders: int             # 总文件夹数
    total_items: int               # 总条目数
    displayed_items: int           # 当前显示的条目数
    is_truncated: bool             # 是否被截断/降级
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "tree": self.tree,
            "level_desc": self.level_desc,
            "total_files": self.total_files,
            "total_folders": self.total_folders,
            "total_items": self.total_items,
            "displayed_items": self.displayed_items,
            "is_truncated": self.is_truncated,
        }


class SmartFileTreeBuilder:
    """智能文件树构建器
    
    根据文件数量自动选择适当的展示层级，避免token溢出。
    
    降级策略：
    1. 完整树 -> 2. 文件夹树（去掉文件） -> 3. 结构树（逐层减少深度）
    """
    
    def __init__(self, config: Optional[FileTreeConfig] = None):
        self.config = config or FileTreeConfig()
    
    def build(self, all_paths: List[str], base_dir_path: str) -> FileTreeResult:
        """
        构建自适应文件树
        
        Args:
            all_paths: 所有文件和目录路径列表
            base_dir_path: 基础目录路径，用于计算相对路径
            
        Returns:
            FileTreeResult: 包含树结构和统计信息的结果
        """
        # 统计原始数据
        total_files = sum(1 for p in all_paths if os.path.isfile(p))
        total_folders = sum(1 for p in all_paths if os.path.isdir(p))
        total_items = total_files + total_folders
        
        # 第一步：构建完整文件树
        full_tree = self._build_full_tree(all_paths, base_dir_path)
        full_tree_count = self._count_tree_items(full_tree)
        
        logger.debug(f"完整文件树条目数: {full_tree_count}, 阈值: {self.config.max_items}")
        
        if full_tree_count <= self.config.max_items:
            logger.info(f"使用完整文件树（{full_tree_count} 项）")
            return FileTreeResult(
                tree=full_tree,
                level_desc="完整文件树",
                total_files=total_files,
                total_folders=total_folders,
                total_items=total_items,
                displayed_items=full_tree_count,
                is_truncated=False
            )
        
        # 第二步：降级为文件夹树（去掉最底层文件）
        folder_tree = self._collapse_to_folders_only(full_tree)
        folder_count = self._count_tree_items(folder_tree)
        
        logger.debug(f"文件夹树条目数: {folder_count}")
        
        if folder_count <= self.config.max_items:
            logger.info(f"降级为文件夹树（{folder_count} 项）")
            return FileTreeResult(
                tree=folder_tree,
                level_desc="文件夹树（不含文件）",
                total_files=total_files,
                total_folders=total_folders,
                total_items=total_items,
                displayed_items=folder_count,
                is_truncated=True
            )
        
        # 第三步：逐层降低深度，直到满足条件
        current_depth = self._get_tree_depth(folder_tree)
        target_depth = current_depth - 1
        
        while target_depth >= self.config.min_depth:
            reduced_tree = self._collapse_to_depth(full_tree, target_depth)
            reduced_count = self._count_tree_items(reduced_tree)
            
            logger.debug(f"深度 {target_depth} 时条目数: {reduced_count}")
            
            if reduced_count <= self.config.max_items:
                logger.info(f"降级为结构树，保留前 {target_depth} 层（{reduced_count} 项）")
                return FileTreeResult(
                    tree=reduced_tree,
                    level_desc=f"结构树（保留前 {target_depth} 层）",
                    total_files=total_files,
                    total_folders=total_folders,
                    total_items=total_items,
                    displayed_items=reduced_count,
                    is_truncated=True
                )
            
            target_depth -= 1
        
        # 兜底：返回最小深度
        final_tree = self._collapse_to_depth(full_tree, self.config.min_depth)
        final_count = self._count_tree_items(final_tree)
        logger.info(f"降级为顶层结构，保留 {self.config.min_depth} 层（{final_count} 项）")
        return FileTreeResult(
            tree=final_tree,
            level_desc=f"顶层结构（保留 {self.config.min_depth} 层）",
            total_files=total_files,
            total_folders=total_folders,
            total_items=total_items,
            displayed_items=final_count,
            is_truncated=True
        )
    
    def _build_full_tree(self, all_paths: List[str], base_dir_path: str) -> List[Dict]:
        """
        从路径列表构建完整树结构
        
        Args:
            all_paths: 所有文件和目录路径列表
            base_dir_path: 基础目录路径
            
        Returns:
            嵌套的树结构列表
        """
        # 构建路径到条目的映射
        path_to_entry = {}
        
        # 首先创建所有条目
        for path in all_paths:
            entry_name = os.path.basename(path)
            relative_path = os.path.relpath(path, base_dir_path)
            is_dir = os.path.isdir(path)
            
            entry = {
                "id": relative_path.replace("\\", "/"),
                "title": entry_name,
                "isFolder": is_dir
            }
            if is_dir:
                entry["children"] = []
            
            path_to_entry[path] = entry
        
        # 构建树结构：将子条目添加到父条目的 children 中
        for path, entry in path_to_entry.items():
            parent_path = os.path.dirname(path)
            if parent_path in path_to_entry:
                path_to_entry[parent_path]["children"].append(entry)
        
        # 返回根目录下的直接子项
        root_entries = []
        normalized_base_path = os.path.normpath(base_dir_path)
        for path, entry in path_to_entry.items():
            parent_path = os.path.dirname(path)
            if parent_path == normalized_base_path or parent_path == "":
                root_entries.append(entry)
        
        # 排序：文件夹在前，按名称排序
        return self._sort_items(root_entries)
    
    def _count_tree_items(self, tree: List[Dict]) -> int:
        """递归计算树中的条目总数"""
        count = 0
        for item in tree:
            count += 1
            if item.get("isFolder") and item.get("children"):
                count += self._count_tree_items(item["children"])
        return count
    
    def _get_tree_depth(self, tree: List[Dict]) -> int:
        """获取树的最大深度"""
        if not tree:
            return 0
        
        max_depth = 0
        for item in tree:
            if item.get("isFolder") and item.get("children"):
                child_depth = self._get_tree_depth(item["children"])
                max_depth = max(max_depth, child_depth + 1)
            else:
                max_depth = max(max_depth, 1)
        
        return max_depth
    
    def _collapse_to_folders_only(self, tree: List[Dict]) -> List[Dict]:
        """
        将树折叠为仅文件夹（去掉所有文件）
        
        Args:
            tree: 原始树结构
            
        Returns:
            仅包含文件夹的树结构
        """
        result = []
        
        for item in tree:
            # 只保留文件夹
            if not item.get("isFolder"):
                continue
            
            new_item = {
                "id": item["id"],
                "title": item["title"],
                "isFolder": True,
                "children": []
            }
            
            # 递归处理子项
            if item.get("children"):
                children = self._collapse_to_folders_only(item["children"])
                new_item["children"] = children
            
            result.append(new_item)
        
        return self._sort_items(result)
    
    def _collapse_to_depth(self, tree: List[Dict], max_depth: int, current_depth: int = 1) -> List[Dict]:
        """
        将树折叠到指定深度
        
        Args:
            tree: 原始树结构
            max_depth: 保留的最大深度
            current_depth: 当前深度（递归用）
            
        Returns:
            折叠后的树结构
        """
        result = []
        
        for item in tree:
            # 如果是文件且已超过保留深度，跳过
            if not item.get("isFolder"):
                if current_depth <= max_depth:
                    result.append({
                        "id": item["id"],
                        "title": item["title"],
                        "isFolder": False
                    })
                continue
            
            # 如果是文件夹
            new_item = {
                "id": item["id"],
                "title": item["title"],
                "isFolder": True,
                "children": []
            }
            
            # 决定是否递归处理子项
            if current_depth < max_depth and item.get("children"):
                children = self._collapse_to_depth(
                    item["children"], 
                    max_depth, 
                    current_depth + 1
                )
                new_item["children"] = children
            
            result.append(new_item)
        
        return self._sort_items(result)
    
    def _sort_items(self, items: List[Dict]) -> List[Dict]:
        """
        对项目列表进行排序：文件夹在前，按名称自然排序
        
        Args:
            items: 项目列表
            
        Returns:
            排序后的列表
        """
        try:
            from natsort import natsorted
            # 按名称自然顺序排序
            sorted_items = natsorted(items, key=lambda item: item["title"])
        except ImportError:
            # 如果没有 natsort，使用普通排序
            sorted_items = sorted(items, key=lambda item: item["title"])
        
        # 文件夹在前，文件在后
        folders = [item for item in sorted_items if item.get("isFolder", False)]
        files = [item for item in sorted_items if not item.get("isFolder", False)]
        
        return folders + files


def build_adaptive_file_tree(
    all_paths: List[str], 
    base_dir_path: str,
    max_items: int = 100,
    min_depth: int = 1
) -> FileTreeResult:
    """
    便捷函数：构建自适应文件树
    
    Args:
        all_paths: 所有文件和目录路径列表
        base_dir_path: 基础目录路径
        max_items: 最大条目数阈值
        min_depth: 最小保留深度
        
    Returns:
        FileTreeResult: 包含树结构和统计信息的结果
        
    Example:
        >>> paths = ['/project/src/main.py', '/project/src/utils.py', '/project/docs/']
        >>> result = build_adaptive_file_tree(paths, '/project')
        >>> print(result.level_desc)  # "完整文件树" 或 "文件夹树（不含文件）" 等
        >>> print(f"总计: {result.total_items}, 显示: {result.displayed_items}")
    """
    config = FileTreeConfig(max_items=max_items, min_depth=min_depth)
    builder = SmartFileTreeBuilder(config)
    return builder.build(all_paths, base_dir_path)


def format_tree_for_prompt(result: FileTreeResult, data_dir: str = "") -> str:
    """
    将树格式化为提示词字符串，包含统计信息让AI了解显示范围
    
    Args:
        result: 文件树结果
        data_dir: 数据目录路径（用于显示根目录名）
        
    Returns:
        格式化的字符串，包含统计信息
    """
    lines = []
    
    # 显示根目录名
    if data_dir:
        root_name = os.path.basename(data_dir) or "project"
        lines.append(f"工作区根目录：{root_name}/")
    
    # 添加统计信息头，让AI了解显示范围
    total = result.total_items
    displayed = result.displayed_items
    
    if result.is_truncated:
        # 被截断的情况，明确告知AI
        lines.append(f"[项目文件结构 - {result.level_desc}]")
        lines.append(f"统计: 共{total} 项")
        lines.append(f"当前显示: {displayed} 项 (已自动折叠部分文件夹以节省上下文)")
    else:
        # 完整显示
        lines.append(f"[项目文件结构 - {result.level_desc}]")
        lines.append(f"统计: 共{total} 项")
    
    lines.append("")
    
    # 输出路径列表格式
    def collect_paths(node: Dict, parent_path: str = "") -> List[str]:
        """递归收集路径"""
        result_lines = []
        
        # 构建当前路径
        current_path = f"{parent_path}/{node['title']}" if parent_path else node['title']
        
        if node.get("isFolder"):
            # 文件夹：先输出文件夹路径
            result_lines.append(current_path + "/")
            # 递归处理子项
            if node.get("children"):
                for child in node["children"]:
                    result_lines.extend(collect_paths(child, current_path))
        else:
            # 文件：直接输出
            result_lines.append(current_path)
        
        return result_lines
    
    # 遍历根节点收集路径
    for item in result.tree:
        lines.extend(collect_paths(item, ""))
    
    return "\n".join(lines)
