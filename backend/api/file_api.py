import logging
from typing import List
from typing import  Dict, Any
from pydantic import BaseModel, Field
from fastapi.responses import Response
from fastapi import APIRouter, UploadFile, File as FastAPIFile
from backend.core.file.core.file_service import FileService
from backend.core.file.services.image_upload_service import image_upload_service
from backend.api.decorators import handle_api_errors

logger = logging.getLogger(__name__)
file_service = FileService()

# 创建API路由器
router = APIRouter(prefix="/api/file", tags=["File Management"])


class CreateFileRequest(BaseModel):
    """创建文件请求"""
    name: str = Field(..., description="文件名称", min_length=1)
    content: str = Field(default="", description="文件内容")
    parent_path: str = Field(default="", description="父目录路径")

class CreateFolderRequest(BaseModel):
    """创建文件夹请求"""
    name: str = Field(..., description="文件夹名称", min_length=1)
    parent_path: str = Field(default="", description="父目录路径")

class RenameItemRequest(BaseModel):
    """重命名文件或文件夹请求"""
    old_path: str = Field(..., description="原路径", min_length=1)
    new_name: str = Field(..., description="新名称", min_length=1)

class MoveItemRequest(BaseModel):
    """移动文件或文件夹请求"""
    source_path: str = Field(..., description="源路径", min_length=1)
    target_path: str = Field(..., description="目标路径", min_length=1)

class CopyItemRequest(BaseModel):
    """复制文件或文件夹请求"""
    source_path: str = Field(..., description="源路径", min_length=1)
    target_path: str = Field(..., description="目标路径", min_length=1)

class UpdateFilesOrderRequest(BaseModel):
    """更新文件顺序请求"""
    paths: List[str] = Field(..., description="文件路径列表", min_items=1)
    directory_path: str = Field(default="", description="目录路径")

class UpdateFoldersOrderRequest(BaseModel):
    """更新文件夹顺序请求"""
    paths: List[str] = Field(..., description="文件夹路径列表", min_items=1)
    directory_path: str = Field(default="", description="目录路径")

class UpdateContentRequest(BaseModel):
    """更新文件内容请求"""
    content: str = Field(..., description="文件内容")

@router.post("/files", summary="创建文件", response_model=Dict[str, Any])
@handle_api_errors("创建文件")
async def create_file(request: CreateFileRequest) -> Dict[str, Any]:
    """创建新文件"""
    result = await file_service.create_chapter(
        name=request.name,
        content=request.content,
        parent_path=request.parent_path
    )
    return result.dict()

@router.post("/folders", summary="创建文件夹", response_model=Dict[str, Any])
@handle_api_errors("创建文件夹")
async def create_folder(request: CreateFolderRequest) -> Dict[str, Any]:
    """创建新文件夹"""
    result = await file_service.create_folder(
        name=request.name,
        parent_path=request.parent_path
    )
    return result.dict()

@router.post("/images", summary="上传图片", response_model=Dict[str, Any])
@handle_api_errors("上传图片")
async def upload_image(file: UploadFile = FastAPIFile(...)) -> Dict[str, Any]:
    """上传图片文件"""
    result = await image_upload_service.upload_file(file)
    return result

@router.get("/read/{file_path:path}", summary="读取文件")
@handle_api_errors("获取内容")
async def read_resource(file_path: str):
    content = await file_service.get_chapter_content(file_path)
    return {
        "id": file_path,
        "content": content
    }


@router.delete("/delete/{file_path:path}", summary="删除章节/文件夹")
@handle_api_errors("删除")
async def delete_chapter(file_path: str):
    await file_service.delete_chapter(file_path)
    return Response(status_code=204)

@router.post("/rename", summary="重命名文件或文件夹")
@handle_api_errors("重命名")
async def rename_item(request: RenameItemRequest):
    """重命名文件或文件夹"""
    await file_service.rename_item(request.old_path, request.new_name)
    return Response(status_code=204)

@router.post("/move", summary="移动文件或文件夹")
@handle_api_errors("移动")
async def move_item(request: MoveItemRequest):
    """移动文件或文件夹"""
    await file_service.move_item(request.source_path, request.target_path)
    return Response(status_code=204)

@router.post("/copy", summary="复制文件或文件夹")
@handle_api_errors("复制")
async def copy_item(request: CopyItemRequest):
    """复制文件或文件夹"""
    await file_service.copy_item(request.source_path, request.target_path)
    return Response(status_code=204)

@router.put("/files/order", summary="更新文件顺序")
@handle_api_errors("更新文件顺序")
async def update_files_order(request: UpdateFilesOrderRequest):
    """更新指定目录下文件的顺序"""
    await file_service.update_file_order(
        request.paths,
        request.directory_path
    )
    return Response(status_code=204)

@router.put("/folders/order", summary="更新文件夹顺序")
@handle_api_errors("更新文件夹顺序")
async def update_folders_order(request: UpdateFoldersOrderRequest):
    """更新指定目录下文件夹的顺序"""
    await file_service.update_folder_order(
        request.paths,
        request.directory_path
    )
    return Response(status_code=204)
    

@router.get("/list", summary="获取文件列表", response_model=dict)
@handle_api_errors("获取文件列表")
async def list_novel_files():
    """获取novel目录下所有文件"""
    result = await file_service.list_novel_files()
    return result

@router.get("/tree", summary="获取文件树", response_model=List[dict])
@handle_api_errors("获取文件树")
async def get_file_tree():
    """获取文件树结构"""
    chapters = await file_service.list_chapters()
    return chapters

@router.put("/update/{file_path:path}", summary="更新文件内容")
@handle_api_errors("更新文件内容")
async def update_content(file_path: str, request: UpdateContentRequest):
    """更新文件内容（包含写入和更新两种场景）"""
    await file_service.update_chapter_content(file_path, request.content)
    return Response(status_code=204)