import os
import shutil
import aiofiles
import uuid
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from fastapi import HTTPException, UploadFile
from natsort import natsorted
from backend.config import settings


def sort_items(items: List[Dict]) -> List[Dict]:
    """对项目列表进行自动排序（按名称自然顺序）"""
    if not items or not isinstance(items, list):
        return []

    # 按名称自然顺序排序
    sorted_items = natsorted(items, key=lambda item: item["title"])
    
    # 文件夹在前，文件在后
    folders = [item for item in sorted_items if item.get("isFolder", False)]
    files = [item for item in sorted_items if not item.get("isFolder", False)]
    
    return folders + files


async def read_directory_recursive(dir_path: str, base_dir_path: str) -> List[Dict]:
    """递归读取目录结构"""
    try:
        entries = os.listdir(dir_path)
    except Exception as e:
        print(f"读取目录失败 {dir_path}: {e}")
        return []

    result = []

    for entry_name in entries:
        if entry_name.startswith('.') or entry_name.startswith('$'):
            continue

        full_path = os.path.join(dir_path, entry_name)
        relative_path = os.path.relpath(full_path, base_dir_path)

        if os.path.isdir(full_path):
            children = await read_directory_recursive(full_path, base_dir_path)
            result.append({
                "id": relative_path.replace("\\", "/"),
                "title": entry_name,
                "isFolder": True,
                "children": sort_items(children)
            })
        else:
            result.append({
                "id": relative_path.replace("\\", "/"),
                "title": entry_name,
                "isFolder": False
            })

    sorted_result = sort_items(result)
    return sorted_result


async def get_file_tree() -> List[Dict]:
    """获取文件树结构"""
    try:
        os.makedirs(settings.NOVEL_DIR, exist_ok=True)
        tree = await read_directory_recursive(settings.NOVEL_DIR, settings.NOVEL_DIR)
        return tree
    except Exception as error:
        print(f"获取文件树失败: {error}")
        return []


async def generate_unique_name(target_dir: str, original_name: str, is_folder: bool = False) -> str:
    """生成唯一的文件或文件夹名称"""
    if is_folder:
        base_name = original_name
        ext_name = ""
    else:
        base_name, ext_name = os.path.splitext(original_name)

    counter = 0
    unique_name = original_name

    while True:
        if counter == 0:
            current_name = original_name
        else:
            current_name = f"{base_name}-副本{counter}{ext_name}"

        full_path = os.path.join(target_dir, current_name)

        if not os.path.exists(full_path):
            unique_name = current_name
            break

        counter += 1

    return unique_name


async def create_file(name: str, content: str = "", parent_path: str = "") -> Dict[str, Any]:
    """创建文件"""
    if not name.endswith('.md'):
        name += '.md'

    target_dir = os.path.join(settings.NOVEL_DIR, parent_path)
    unique_name = await generate_unique_name(target_dir, name, False)

    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, unique_name)

    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
        await f.write(content)

    stat = os.stat(file_path)
    relative_id = os.path.relpath(file_path, settings.NOVEL_DIR)

    return {
        "id": relative_id,
        "name": unique_name,
        "path": file_path,
        "type": "file",
        "content": content,
        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
        "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
    }


async def create_folder(name: str, parent_path: str = "") -> Dict[str, Any]:
    """创建文件夹"""
    target_dir = os.path.join(settings.NOVEL_DIR, parent_path)
    unique_name = await generate_unique_name(target_dir, name, True)

    folder_path = os.path.join(target_dir, unique_name)
    os.makedirs(folder_path, exist_ok=True)

    stat = os.stat(folder_path)
    relative_id = os.path.relpath(folder_path, settings.NOVEL_DIR)

    return {
        "id": relative_id,
        "name": unique_name,
        "path": folder_path,
        "type": "folder",
        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
        "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
    }


async def read_file(file_path: str) -> str:
    """读取文件内容"""
    full_path = Path(settings.NOVEL_DIR) / file_path
    async with aiofiles.open(full_path, 'r', encoding='utf-8') as f:
        content = await f.read()
    return content


async def update_file(file_path: str, content: str):
    """更新文件内容"""
    full_path = Path(settings.NOVEL_DIR) / file_path
    async with aiofiles.open(full_path, 'w', encoding='utf-8') as f:
        await f.write(content)


async def delete_file(file_path: str):
    """删除文件或文件夹"""
    full_path = Path(settings.NOVEL_DIR) / file_path

    if os.path.exists(full_path):
        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
    else:
        raise FileNotFoundError(f"文件不存在: {full_path}")


async def rename_file(old_path: str, new_name: str):
    """重命名文件或文件夹"""
    full_old_path = Path(settings.NOVEL_DIR) / old_path
    parent_dir = os.path.dirname(full_old_path)
    new_path = os.path.join(parent_dir, new_name)
    os.rename(full_old_path, new_path)


async def move_file(source_path: str, target_path: str):
    """移动文件或文件夹"""
    full_source = Path(source_path)
    full_target = Path(target_path)
    
    if os.path.isdir(full_target):
        target_path = os.path.join(full_target, os.path.basename(full_source))
    
    shutil.move(full_source, target_path)


async def copy_file(source_path: str, target_path: str):
    """复制文件或文件夹"""
    full_source = Path(source_path)
    full_target = Path(target_path)
    
    if not os.path.exists(full_source):
        raise FileNotFoundError(f"源路径不存在: {full_source}")

    if os.path.isdir(full_target):
        source_name = os.path.basename(full_source)
        target_dir = full_target
        unique_name = await generate_unique_name(target_dir, source_name, os.path.isdir(full_source))
        target_path = os.path.join(target_dir, unique_name)
    else:
        target_dir = os.path.dirname(full_target)
        os.makedirs(target_dir, exist_ok=True)
        if os.path.exists(full_target):
            source_name = os.path.basename(full_source)
            unique_name = await generate_unique_name(target_dir, source_name, os.path.isdir(full_source))
            target_path = os.path.join(target_dir, unique_name)

    if os.path.isdir(full_source):
        shutil.copytree(full_source, target_path, dirs_exist_ok=True)
    else:
        shutil.copy2(full_source, target_path)



async def search_files(query: str) -> List[Dict[str, Any]]:
    """搜索文件内容"""
    try:
        results = []
        for root, dirs, files in os.walk(settings.NOVEL_DIR):
            for item in dirs + files:
                if query.lower() in item.lower():
                    item_path = os.path.join(root, item)
                    stat = os.stat(item_path)

                    item_type = "folder" if os.path.isdir(item_path) else "file"
                    content = None
                    if item_type == "file":
                        try:
                            async with aiofiles.open(item_path, 'r', encoding='utf-8') as f:
                                content = await f.read()
                        except:
                            content = None

                    relative_id = os.path.relpath(item_path, settings.NOVEL_DIR)
                    results.append({
                        "id": relative_id,
                        "name": item,
                        "path": item_path,
                        "type": item_type,
                        "content": content,
                        "created_at": stat.st_ctime,
                        "updated_at": stat.st_mtime
                    })

        return results
    except Exception as e:
        print(f"搜索文件失败: {e}")
        return []


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
