"""
下载Monaco Editor文件到本地static目录
"""
import os
import urllib.request
from pathlib import Path

# 定义要下载的文件列表
MONACO_FILES = [
    "loader.js",
    "editor/editor.main.js",
    "editor/editor.main.css",
    "editor/editor.main.nls.zh-cn.js",
    "basic-languages/markdown/markdown.js",
    "base/worker/workerMain.js",
    "base/common/worker/simpleWorker.nls.js",
    "base/browser/ui/codicons/codicon/codicon.ttf",
]

BASE_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/"
STATIC_DIR = Path(__file__).parent.parent / "static" / "monaco"


def download_file(url: str, dest_path: Path):
    """下载文件到指定路径"""
    print(f"下载: {url}")
    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, dest_path)
        print(f"  ✓ 保存到: {dest_path}")
    except Exception as e:
        print(f"  ✗ 下载失败: {e}")
        raise


def main():
    print("开始下载Monaco Editor文件...")
    print(f"目标目录: {STATIC_DIR.absolute()}")
    
    for file_path in MONACO_FILES:
        url = BASE_URL + file_path
        dest_path = STATIC_DIR / file_path
        download_file(url, dest_path)
    
    print("\n所有文件下载完成！")
    print(f"文件保存在: {STATIC_DIR.absolute()}")


if __name__ == "__main__":
    main()
