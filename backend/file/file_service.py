import os
import shutil
import aiofiles
import uuid
import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from fastapi import HTTPException, UploadFile
from natsort import natsorted
from backend.settings.settings import settings
from backend.file.ripgrep_service import ripgrep_service
from backend.file.ignore_parser import IgnoreParser

logger = logging.getLogger(__name__)


def resolve_file_path(file_path: str) -> Path:
    """解析文件路径，支持相对路径和绝对路径
    
    规则：
    - 绝对路径：直接使用（如 /home/user/file.txt）
    - 相对路径：基于 DATA_DIR 解析（如 file.txt -> {DATA_DIR}/file.txt）
    
    Args:
        file_path: 输入的文件路径（相对或绝对）
        
    Returns:
        Path: 解析后的完整路径
    """
    path = Path(file_path)
    
    # 如果是绝对路径，直接使用
    if path.is_absolute():
        return path
    
    # 相对路径，基于 DATA_DIR 解析
    return Path(settings.DATA_DIR) / path


def normalize_to_absolute(file_path: str) -> str:
    """将路径规范化为绝对路径字符串
    
    用于存储到 additionalInfo 等配置中，确保始终保存绝对路径
    
    Args:
        file_path: 输入的文件路径
        
    Returns:
        str: 标准化后的绝对路径字符串
    """
    resolved = resolve_file_path(file_path)
    # 解析并规范化路径（去除 .. 等）
    return str(resolved.resolve())
def sort_items(items: List[Dict]) -> List[Dict]:
    """对项目列表进行自动排序"""
    # 按名称自然顺序排序
    sorted_items = natsorted(items, key=lambda item: item["title"])
    
    # 文件夹在前，文件在后
    folders = [item for item in sorted_items if item.get("isFolder", False)]
    files = [item for item in sorted_items if not item.get("isFolder", False)]
    
    return folders + files


async def get_file_tree(dir_path: str, base_dir_path: str, ignore_parser=None) -> List[Dict]:
    """递归读取目录结构（使用集合差集过滤）
    
    Args:
        dir_path: 要读取的目录路径
        base_dir_path: 基础目录路径，用于计算相对路径
        ignore_parser: 忽略规则解析器
    
    Returns:
        文件树结构列表
    """
    # 使用 os.walk() 获取所有文件和目录路径
    all_paths = set()
    for root, dirs, files in os.walk(dir_path):
        # 添加目录路径
        for d in dirs:
            all_paths.add(os.path.normpath(os.path.join(root, d)))
        # 添加文件路径
        for f in files:
            all_paths.add(os.path.normpath(os.path.join(root, f)))
    
    # 如果有忽略解析器，过滤掉被忽略的路径
    if ignore_parser:
        ignored_paths = ignore_parser.get_ignored_paths()
        all_paths = all_paths - ignored_paths
    
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
    normalized_dir_path = os.path.normpath(dir_path)
    for path, entry in path_to_entry.items():
        parent_path = os.path.dirname(path)
        if parent_path == normalized_dir_path:
            root_entries.append(entry)
    
    return sort_items(root_entries)


async def get_file_tree_for_user(dir_path: str, base_dir_path: str) -> List[Dict]:
    """递归读取目录结构（用于前端用户）
    
    使用 .userignore 文件过滤文件
    
    Args:
        dir_path: 要读取的目录路径
        base_dir_path: 基础目录路径，用于计算相对路径
    
    Returns:
        文件树结构列表
    """
    ignore_file = os.path.join(settings.DATA_DIR, '.userignore')
    ignore_parser = IgnoreParser(ignore_file, settings.DATA_DIR)
    return await get_file_tree(dir_path, base_dir_path, ignore_parser)


async def get_file_tree_for_ai(dir_path: str, base_dir_path: str):
    """递归读取目录结构（用于AI系统提示词）
    
    使用 .aiignore 文件过滤文件，并自动应用智能降级策略
    当文件数量超过阈值时，自动从完整文件树降级为文件夹树或结构树
    
    Args:
        dir_path: 要读取的目录路径
        base_dir_path: 基础目录路径，用于计算相对路径
    
    Returns:
        FileTreeResult: 包含树结构和统计信息的结果对象
    """
    # 使用 os.walk() 获取所有文件和目录路径
    all_paths = set()
    for root, dirs, files in os.walk(dir_path):
        # 添加目录路径
        for d in dirs:
            all_paths.add(os.path.normpath(os.path.join(root, d)))
        # 添加文件路径
        for f in files:
            all_paths.add(os.path.normpath(os.path.join(root, f)))
    
    # 应用忽略规则
    ignore_file = os.path.join(settings.DATA_DIR, '.aiignore')
    ignore_parser = IgnoreParser(ignore_file, settings.DATA_DIR)
    if ignore_parser:
        ignored_paths = ignore_parser.get_ignored_paths()
        all_paths = all_paths - ignored_paths
    
    # 使用智能文件树构建器，应用自适应降级策略
    from backend.file.smart_file_tree import build_adaptive_file_tree, FileTreeResult
    result = build_adaptive_file_tree(
        list(all_paths),
        base_dir_path,
        max_items=100,  # 阈值：超过100项自动降级
        min_depth=1     # 至少保留1层目录结构
    )
    
    logger.info(f"AI文件树已生成: {result.level_desc} "
                f"(总计 {result.total_items} 项, 显示 {result.displayed_items} 项)")
    return result


async def create_item(name: str, is_folder: bool = False, parent_path: str = "") -> Dict[str, Any]:
    """创建文件或文件夹
    
    Args:
        name: 文件或文件夹名称
        is_folder: 是否为文件夹
        parent_path: 父目录路径
    
    Returns:
        创建的项目信息
    """
    target_dir = os.path.join(settings.DATA_DIR, parent_path)
    item_path = os.path.join(target_dir, name)
    
    # 检查文件/文件夹是否已存在
    if os.path.exists(item_path):
        raise HTTPException(status_code=409, detail=f"{'文件夹' if is_folder else '文件'} '{name}' 已存在")

    # 根据类型创建文件或文件夹
    if is_folder:
        os.makedirs(item_path, exist_ok=True)
    else:
        async with aiofiles.open(item_path, 'w', encoding='utf-8') as f:
            await f.write("")

    # 获取文件状态信息
    relative_id = os.path.relpath(item_path, settings.DATA_DIR)

    # 构建返回结果
    result = {
        "id": relative_id,
        "title": name,
        "path": item_path,
        "type": "folder" if is_folder else "file"
    }

    return result


async def read_file(file_path: str) -> str:
    """读取文件内容
    """
    full_path = resolve_file_path(file_path)
    # 如果文件不存在，返回空字符串（用于AI创建新文件的场景）
    if not full_path.exists():
        return ''
    async with aiofiles.open(full_path, 'r', encoding='utf-8') as f:
        content = await f.read()
    return content


async def update_file(file_path: str, content: str):
    """更新文件内容
    """
    full_path = resolve_file_path(file_path)
    # 自动创建父文件夹（如果不存在）
    full_path.parent.mkdir(parents=True, exist_ok=True)
    # 将 \r\n 转换为 \n，避免Windows换行符问题
    content = content.replace('\r\n', '\n')
    async with aiofiles.open(full_path, 'w', encoding='utf-8') as f:
        await f.write(content)


async def delete_file(file_path: str):
    """删除文件或文件夹
    """
    full_path = resolve_file_path(file_path)
    if os.path.isdir(full_path):
        shutil.rmtree(full_path)
    else:
        os.remove(full_path)

async def rename_file(old_path: str, new_name: str):
    """重命名文件或文件夹"""
    full_old_path = resolve_file_path(old_path)
    parent_dir = os.path.dirname(full_old_path)
    new_path = os.path.join(parent_dir, new_name)
    # 检查目标路径是否已存在
    if os.path.exists(new_path):
        raise HTTPException(
            status_code=400,
            detail=f"目标已存在: {new_path}"
        )
    os.rename(full_old_path, new_path)


# 经测试，copy_file如果出现错误，尤其是“文件/文件夹已存在”时，控制台显示错误，但是并不会被FastAPI正确处理，只会显示TypeError。所以直接在函数内提前验证，及时抛出错误。
# move_file则可以被捕获错误，但最好统一成copy_file的形式（问题根源可能是shutil的move和copy方法不同）

async def move_file(source_path: str, target_path: str):
    """移动文件或文件夹"""
    full_source = resolve_file_path(source_path)
    full_target_dir = resolve_file_path(target_path)
    source_name = os.path.basename(full_source)
    full_target_path = os.path.join(full_target_dir, source_name)
    print("完整来源路径:",full_source,"完整目标路径：",full_target_dir)
    # 检查目标路径是否已存在
    if os.path.exists(full_target_path):
        raise HTTPException(
            status_code=400,
            detail=f"目标已存在: {full_target_path}"
        )

    shutil.move(full_source, full_target_path)


async def copy_file(source_path: str, target_path: str):
    """复制文件或文件夹，如果目标已存在则失败"""
    full_source = resolve_file_path(source_path) # 原路径
    full_target_dir = resolve_file_path(target_path) # 目标目录
    source_name = os.path.basename(full_source)
    full_target_path = os.path.join(full_target_dir, source_name) # 最终形成的新路径（目标目录+文件名/文件夹名）
    print("完整来源路径:",full_source,"完整目标路径：",full_target_dir)
    # 检查目标路径是否已存在
    if os.path.exists(full_target_path):
        raise HTTPException(
            status_code=400,
            detail=f"目标已存在: {full_target_path}"
        )

    if os.path.isdir(full_source):
        shutil.copytree(full_source, full_target_path)
    else:
        shutil.copy2(full_source, full_target_path)


def _normalize_search_path(file_path: str) -> str:
    r"""规范化搜索结果中的文件路径
    
    将路径转换为相对于 DATA_DIR 的相对路径，统一路径分隔符为 /
    
    Args:
        file_path: 原始文件路径（可能是绝对路径或相对路径）
    
    Returns:
        规范化后的文件路径（相对于 DATA_DIR）
    """
    path = Path(file_path)
    data_dir = Path(settings.DATA_DIR).resolve()
    
    # 如果是绝对路径，尝试转换为相对于 DATA_DIR 的路径
    if path.is_absolute():
        try:
            # 计算相对于 DATA_DIR 的路径
            relative_path = path.relative_to(data_dir)
            return str(relative_path).replace('\\', '/')
        except ValueError:
            # 路径不在 DATA_DIR 下，保留原路径但统一分隔符
            pass
    
    # 统一路径分隔符为 /
    file_path = file_path.replace('\\', '/')
    
    # 去除 data/ 前缀（ripgrep 返回的是相对于项目根目录的路径）
    for prefix in ('data/'):
        if file_path.startswith(prefix):
            file_path = file_path[len(prefix):]
            break
    
    return file_path


async def search_files(query: str, ignore_file: Optional[str] = None, max_results: int = 100) -> str:
    """搜索文件内容（使用 ripgrep）
    
    Args:
        query: 搜索关键词
        ignore_file: 忽略规则文件路径
        max_results: 最大结果数限制（默认100）
    
    Returns:
        ripgrep 原始输出字符串
    """
    # 使用 ripgrep 搜索
    try:
        return await ripgrep_service.search(
            query=query,
            case_sensitive=False,
            ignore_file=ignore_file,
            max_results=max_results
        )
    except Exception as e:
        logger.error(f"ripgrep 搜索失败: {e}")
        return ""


async def search_files_for_user(query: str) -> Dict[str, Dict[str, Any]]:
    """搜索文件内容（用于前端用户）
    
    使用 .userignore 文件过滤文件
    
    Args:
        query: 搜索关键词
    
    Returns:
        搜索结果字典，按文件路径分组
        格式: {
            "文件路径1": {
                "path": "文件路径1",
                "content": ["内容1", "内容2", ...]
            },
            ...
        }
    """
    ignore_file = os.path.join(settings.DATA_DIR, '.userignore')
    rg_output = await search_files(query, ignore_file)
    
    # 解析 ripgrep 输出，按文件路径分组
    results = {}
    for line in rg_output.split('\n'):
        if not line.strip() or line == '--':
            continue
        
        # 匹配格式：文件路径:行号:内容
        match = re.match(r'^(.+?):(\d+):(.*)$', line)
        if match:
            file_path = match.group(1)
            line_number = match.group(2)
            line_content = match.group(3)
            
            # 使用辅助函数规范化路径
            file_path = _normalize_search_path(file_path)
            
            # 按文件路径分组
            if file_path not in results:
                results[file_path] = {
                    "path": file_path,
                    "content": []
                }
            results[file_path]["content"].append(line_content)
    
    return results


async def search_files_for_ai(query: str) -> str:
    """搜索文件内容（用于AI工具）
    
    使用 .aiignore 文件过滤文件，默认限制100个结果
    如果结果被截断，会添加提示信息
    
    Args:
        query: 搜索关键词
    
    Returns:
        ripgrep 原始输出字符串（已规范化路径），可能包含截断提示
    """
    ignore_file = os.path.join(settings.DATA_DIR, '.aiignore')
    
    # 先搜索 max_results + 1 个，用于判断是否还有更多结果
    max_results = 100
    rg_output = await search_files(query, ignore_file, max_results=max_results + 1)
    
    # 检查是否被截断（如果结果数超过 max_results，说明有更多结果被截断）
    lines = rg_output.split('\n')
    match_lines = [line for line in lines if line.strip() and line != '--' and re.match(r'^.+?(:|\-)\d+\1.*$', line)]
    is_truncated = len(match_lines) > max_results
    
    # 规范化输出中的路径
    filtered_lines = []
    count = 0
    for line in lines:
        if not line.strip() or line == '--':
            continue
        
        # 匹配格式：文件路径:行号:内容（匹配行）
        # 或 文件路径-行号-内容（上下文行）
        match = re.match(r'^(.+?)(:|\-)(\d+)\2(.*)$', line)
        if match:
            # 只保留前 max_results 个匹配
            if count >= max_results:
                continue
            count += 1
            
            file_path = match.group(1)
            separator = match.group(2)
            line_number = match.group(3)
            line_content = match.group(4)
            
            # 使用辅助函数规范化路径
            file_path = _normalize_search_path(file_path)
            
            # 重新组装行
            filtered_lines.append(f"{file_path}{separator}{line_number}{separator}{line_content}")
        else:
            # 不匹配的行直接添加
            filtered_lines.append(line)
    
    result = '\n'.join(filtered_lines)
    
    # 如果结果被截断，添加提示信息
    if is_truncated:
        truncated_count = len(match_lines) - max_results
        result += f"\n\n[提示：检索结果被折叠了 {truncated_count} 个匹配项。建议使用更精确的检索词，或指定具体文件路径以减少检索范围]"
    
    return result


async def upload_image(file: UploadFile) -> Dict[str, Any]:
    """上传图片文件"""
    upload_dir = Path("backend") / "data" / "uploads"
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'}

    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型。仅支持 {', '.join(allowed_extensions)} 格式。"
        )
    
    content = await file.read()
    # 生成唯一文件名
    timestamp = int(os.times().elapsed * 1000)
    random_str = uuid.uuid4().hex[:8]
    filename = f"image_{timestamp}_{random_str}{ext}"
    file_path = upload_dir / filename

    # 写入文件
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)

    return {
        "filename": filename,
        "url": f"http://{settings.HOST}:{settings.PORT}/uploads/{filename}"
    }


async def get_all_file_paths() -> List[str]:
    """获取所有文件路径列表（用于文件路径补全）
    
    返回所有文件的相对路径列表，按字母顺序排序
    
    Returns:
        文件路径列表
    """
    ignore_file = os.path.join(settings.DATA_DIR, '.userignore')
    ignore_parser = IgnoreParser(ignore_file, settings.DATA_DIR)
    ignored_paths = ignore_parser.get_ignored_paths()
    
    file_paths = []
    
    for root, dirs, files in os.walk(settings.DATA_DIR):
        # 过滤掉被忽略的目录
        dirs[:] = [d for d in dirs if os.path.normpath(os.path.join(root, d)) not in ignored_paths]
        
        for file in files:
            file_path = os.path.normpath(os.path.join(root, file))
            if file_path not in ignored_paths:
                # 转换为相对路径
                relative_path = os.path.relpath(file_path, settings.DATA_DIR)
                # 统一使用正斜杠
                relative_path = relative_path.replace('\\', '/')
                file_paths.append(relative_path)
    
    # 使用自然排序
    return natsorted(file_paths)
