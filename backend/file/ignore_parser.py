"""
忽略规则解析器
用于解析 .userignore 和 .aiignore 文件
解析出所有需要忽略的实际路径集合
"""
import os
from typing import Set
from pathlib import Path


class IgnoreParser:
    """忽略规则解析器"""
    
    def __init__(self, ignore_file_path: str = None, data_dir: str = None):
        self.ignore_file_path = ignore_file_path
        self.data_dir = data_dir
        self.ignored_paths: Set[str] = set()
        self._load_rules()
    
    def _load_rules(self):
        """从文件加载规则，解析出所有需要忽略的实际路径"""
        if self.ignore_file_path and os.path.exists(self.ignore_file_path):
            with open(self.ignore_file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    # 跳过空行和注释
                    if not line or line.startswith('#'):
                        continue
                    
                    # 移除开头的 /
                    if line.startswith('/'):
                        line = line[1:]
                    
                    # 构建完整路径
                    full_path = os.path.join(self.data_dir, line)
                    
                    # 检查路径是否存在
                    if os.path.exists(full_path):
                        # 规范化路径
                        normalized_path = os.path.normpath(full_path)
                        
                        if os.path.isdir(normalized_path):
                            # 如果是目录，递归添加所有子文件和子目录
                            self._add_dir_recursively(normalized_path)
                        else:
                            # 如果是文件，直接添加
                            self.ignored_paths.add(normalized_path)
    
    def _add_dir_recursively(self, dir_path: str):
        """递归添加目录下的所有文件和子目录到忽略集合"""
        self.ignored_paths.add(os.path.normpath(dir_path))
        
        try:
            for entry in os.listdir(dir_path):
                full_path = os.path.join(dir_path, entry)
                normalized_path = os.path.normpath(full_path)
                
                if os.path.isdir(normalized_path):
                    self._add_dir_recursively(normalized_path)
                else:
                    self.ignored_paths.add(normalized_path)
        except PermissionError:
            # 忽略权限错误
            pass
    
    def is_ignored(self, path: str, is_dir: bool = False) -> bool:
        """
        检查路径是否应该被忽略
        
        Args:
            path: 要检查的路径（可以是相对路径或绝对路径）
            is_dir: 是否为目录
            
        Returns:
            True 表示应该被忽略
        """
        # 规范化路径
        normalized_path = os.path.normpath(path)
        
        # 检查是否在忽略集合中
        return normalized_path in self.ignored_paths
    
    def get_ignored_paths(self) -> Set[str]:
        """获取所有忽略的路径"""
        return self.ignored_paths.copy()
