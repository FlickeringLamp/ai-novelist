import os
import shutil
import aiofiles
import uuid
from pathlib import Path
from typing import List, Dict, Any
from fastapi import HTTPException, UploadFile
from natsort import natsorted
from backend.config import settings


def sort_items(items: List[Dict]) -> List[Dict]:
    """对项目列表进行自动排序"""
    # 按名称自然顺序排序
    sorted_items = natsorted(items, key=lambda item: item["title"])
    
    # 文件夹在前，文件在后
    folders = [item for item in sorted_items if item.get("isFolder", False)]
    files = [item for item in sorted_items if not item.get("isFolder", False)]
    
    return folders + files


async def get_file_tree(dir_path: str, base_dir_path: str) -> List[Dict]:
    """递归读取目录结构"""
    entries = os.listdir(dir_path)
    result = []

    for entry_name in entries:
        full_path = os.path.join(dir_path, entry_name)
        relative_path = os.path.relpath(full_path, base_dir_path)

        if os.path.isdir(full_path):
            children = await get_file_tree(full_path, base_dir_path)
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


async def generate_unique_name(target_dir: str, is_folder: bool = False) -> str:
    """生成唯一的文件或文件夹名称"""
    if is_folder:
        base_name = "新建文件夹"
        ext_name = ""
    else:
        base_name = "新建文件"
        ext_name = ".md"

    counter = 0
    unique_name = ""

    while True:
        counter += 1
        current_name = f"{base_name}{counter}{ext_name}"

        full_path = os.path.join(target_dir, current_name)

        if not os.path.exists(full_path):
            unique_name = current_name
            break
    return unique_name

async def create_item(is_folder: bool = False, parent_path: str = "") -> Dict[str, Any]:
    """创建文件或文件夹"""
    target_dir = os.path.join(settings.NOVEL_DIR, parent_path)
    unique_name = await generate_unique_name(target_dir, is_folder)
    item_path = os.path.join(target_dir, unique_name)

    # 根据类型创建文件或文件夹
    if is_folder:
        os.makedirs(item_path, exist_ok=True)
    else:
        async with aiofiles.open(item_path, 'w', encoding='utf-8') as f:
            await f.write("")

    # 获取文件状态信息
    relative_id = os.path.relpath(item_path, settings.NOVEL_DIR)

    # 构建返回结果
    result = {
        "id": relative_id,
        "title": unique_name,
        "path": item_path,
        "type": "folder" if is_folder else "file"
    }

    return result


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
    if os.path.isdir(full_path):
        shutil.rmtree(full_path)
    else:
        os.remove(full_path)

async def rename_file(old_path: str, new_name: str):
    """重命名文件或文件夹"""
    full_old_path = Path(settings.NOVEL_DIR) / old_path
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
    full_source = Path(settings.NOVEL_DIR) / source_path
    full_target_dir = Path(settings.NOVEL_DIR) / target_path
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
    full_source = Path(settings.NOVEL_DIR) / source_path # 原路径
    full_target_dir = Path(settings.NOVEL_DIR) / target_path # 目标目录
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



async def search_files(query: str) -> List[Dict[str, Any]]:
    """搜索文件内容"""
    results = []
    for root, dirs, files in os.walk(settings.NOVEL_DIR):
        for item in dirs + files:
            if query.lower() in item.lower():
                item_path = os.path.join(root, item)
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
                    "title": item,
                    "path": item_path,
                    "type": item_type,
                    "content": content,
                })


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
