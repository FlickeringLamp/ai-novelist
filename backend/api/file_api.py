import logging
from typing import List
from typing import Dict, Any
from pydantic import BaseModel, Field
from fastapi.responses import Response
from fastapi import APIRouter, UploadFile, File as FastAPIFile
from backend.file.file_service import (
    create_item,
    read_file,
    update_file,
    delete_file,
    rename_file,
    move_file,
    copy_file,
    get_file_tree,
    upload_image,
)
from backend.config.config import settings

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/file", tags=["File"])


class CreateItemRequest(BaseModel):
    """创建文件或文件夹请求（通用）"""
    parent_path: str = Field(default="", description="父目录路径")
    is_folder: bool = Field(default=False, description="是否为文件夹")


class RenameItemRequest(BaseModel):
    """重命名文件或文件夹请求"""
    old_path: str = Field(..., description="原路径")
    new_name: str = Field(..., description="新名称")


class MoveItemRequest(BaseModel):
    """移动文件或文件夹请求"""
    source_path: str = Field(..., description="源路径")
    target_path: str = Field(..., description="目标路径")


class CopyItemRequest(BaseModel):
    """复制文件或文件夹请求"""
    source_path: str = Field(..., description="源路径")
    target_path: str = Field(..., description="目标路径")


class UpdateContentRequest(BaseModel):
    """更新文件内容请求"""
    content: str = Field(..., description="文件内容")


@router.post("/items", summary="创建文件或文件夹", response_model=Dict[str, Any])
async def api_create_item(request: CreateItemRequest) -> Dict[str, Any]:
    """创建文件或文件夹"""
    return await create_item(
        is_folder=request.is_folder,
        parent_path=request.parent_path
    )

# 暂时没用上
@router.post("/images", summary="上传图片", response_model=Dict[str, Any])
async def api_upload_image(file: UploadFile = FastAPIFile(...)) -> Dict[str, Any]:
    """上传图片文件"""
    result = await upload_image(file)
    return result


@router.get("/read/{file_path:path}", summary="读取文件")
async def api_read_file(file_path: str):
    content = await read_file(file_path)
    return {
        "id": file_path,
        "content": content
    }


@router.delete("/delete/{file_path:path}", summary="删除章节/文件夹")
async def api_delete_file(file_path: str):
    await delete_file(file_path)
    return Response(status_code=204)


@router.post("/rename", summary="重命名文件或文件夹")
async def api_rename_file(request: RenameItemRequest):
    """重命名文件或文件夹"""
    await rename_file(request.old_path, request.new_name)
    return Response(status_code=204)


@router.post("/move", summary="移动文件或文件夹")
async def api_move_file(request: MoveItemRequest):
    """移动文件或文件夹"""
    await move_file(request.source_path, request.target_path)
    return Response(status_code=204)


@router.post("/copy", summary="复制文件或文件夹")
async def api_copy_file(request: CopyItemRequest):
    """复制文件或文件夹"""
    await copy_file(request.source_path, request.target_path)
    return Response(status_code=204)


@router.get("/tree", summary="获取文件树", response_model=List[dict])
async def api_get_file_tree():
    """获取文件树结构"""
    tree = await get_file_tree(settings.NOVEL_DIR, settings.NOVEL_DIR)
    return tree


@router.put("/update/{file_path:path}", summary="更新文件内容")
async def api_update_content(file_path: str, request: UpdateContentRequest):
    """更新文件内容（包含写入和更新两种场景）"""
    await update_file(file_path, request.content)
    return Response(status_code=204)
