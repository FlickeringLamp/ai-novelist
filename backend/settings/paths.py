"""
路径配置模块,确保开发环境，生产环境都能正确找到位置
"""
import os
import sys
from pathlib import Path


def get_model_dir():
    """获取模型目录路径"""
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    return os.path.join(base_dir, 'models', 'embedding')


def get_data_dir():
    """获取数据目录路径"""
    if getattr(sys, 'frozen', False):
        return Path('data')
    else:
        return Path('backend/data')


def get_bin_dir():
    """获取可执行文件目录路径"""
    if getattr(sys, 'frozen', False):
        return Path('bin')
    else:
        return Path('bin')


def get_env_file_path() -> Path:
    """获取环境变量文件路径"""
    if getattr(sys, 'frozen', False):
        return Path(os.path.dirname(sys.executable)) / ".env"
    else:
        return Path(__file__).parent.parent.parent / ".env"
