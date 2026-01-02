"""
文件管理API模块
为前端提供文件操作、文件夹管理、搜索等功能的RESTful API
"""

import os
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File as FastAPIFile
from fastapi.responses import JSONResponse, Response

from .core.file_service import FileService
from .services.image_upload_service import image_upload_service
from .models import FileItem

logger = logging.getLogger(__name__)

# 请求模型
class CreateChapterRequest(BaseModel):
    """创建章节请求"""
    name: str = Field(..., description="章节名称", min_length=1)
    content: str = Field(default="", description="章节内容")
    parent_path: str = Field(default="", description="父目录路径")

class UpdateChapterRequest(BaseModel):
    """更新章节内容请求"""
    content: str = Field(..., description="章节内容")

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

class SearchFilesRequest(BaseModel):
    """搜索文件请求"""
    query: str = Field(..., description="搜索关键词", min_length=1)

class UpdateFileOrderRequest(BaseModel):
    """更新文件顺序请求"""
    file_paths: List[str] = Field(..., description="文件路径列表", min_items=1)
    directory_path: str = Field(default="", description="目录路径")

class UpdateFolderOrderRequest(BaseModel):
    """更新文件夹顺序请求"""
    folder_paths: List[str] = Field(..., description="文件夹路径列表", min_items=1)
    directory_path: str = Field(default="", description="目录路径")

class UploadBase64ImageRequest(BaseModel):
    """上传Base64图片请求"""
    data: str = Field(..., description="Base64图片数据", min_length=1)
    filename: str = Field(..., description="文件名", min_length=1)

class WriteFileRequest(BaseModel):
    """写入文件请求"""
    content: str = Field(..., description="文件内容")

# 创建API路由器
router = APIRouter(prefix="/api/file", tags=["File Management"])

# 创建全局文件服务实例
file_service = FileService()

# 文件操作API端点
@router.post("/chapters", summary="创建章节", response_model=dict)
async def create_chapter(request: CreateChapterRequest):
    """创建新章节"""
    try:
        chapter = await file_service.create_chapter(
            name=request.name,
            content=request.content,
            parent_path=request.parent_path
        )
        return chapter.dict()
    except Exception as e:
        logger.error(f"创建章节失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建章节失败: {str(e)}")

@router.get("/chapters/{chapter_id}", summary="获取章节内容", response_model=dict)
async def get_chapter_content(chapter_id: str):
    """获取章节内容"""
    try:
        content = await file_service.get_chapter_content(chapter_id)
        return {
            "id": chapter_id,
            "content": content
        }
    except Exception as e:
        logger.error(f"获取章节内容失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取章节内容失败: {str(e)}")

@router.put("/chapters/{chapter_id}", summary="更新章节内容")
async def update_chapter_content(chapter_id: str, request: UpdateChapterRequest):
    """更新章节内容"""
    try:
        await file_service.update_chapter_content(chapter_id, request.content)
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"更新章节内容失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新章节内容失败: {str(e)}")

@router.delete("/chapters/{chapter_id}", summary="删除章节")
async def delete_chapter(chapter_id: str):
    """删除章节"""
    try:
        await file_service.delete_chapter(chapter_id)
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"删除章节失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除章节失败: {str(e)}")

# 文件夹操作API端点
@router.post("/folders", summary="创建文件夹", response_model=dict)
async def create_folder(request: CreateFolderRequest):
    """创建新文件夹"""
    try:
        folder = await file_service.create_folder(
            name=request.name,
            parent_path=request.parent_path
        )
        return folder.dict()
    except Exception as e:
        logger.error(f"创建文件夹失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建文件夹失败: {str(e)}")

@router.post("/rename", summary="重命名文件或文件夹")
async def rename_item(request: RenameItemRequest):
    """重命名文件或文件夹"""
    try:
        await file_service.rename_item(request.old_path, request.new_name)
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"重命名失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重命名失败: {str(e)}")

@router.post("/move", summary="移动文件或文件夹")
async def move_item(request: MoveItemRequest):
    """移动文件或文件夹"""
    try:
        await file_service.move_item(request.source_path, request.target_path)
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"移动失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"移动失败: {str(e)}")

@router.post("/copy", summary="复制文件或文件夹")
async def copy_item(request: CopyItemRequest):
    """复制文件或文件夹"""
    try:
        await file_service.copy_item(request.source_path, request.target_path)
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"复制失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"复制失败: {str(e)}")

# 搜索和排序API端点
@router.post("/search", summary="搜索文件", response_model=List[dict])
async def search_files(request: SearchFilesRequest):
    """搜索文件"""
    try:
        files = await file_service.search_files(request.query)
        return [file.dict() for file in files]
    except Exception as e:
        logger.error(f"搜索文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"搜索文件失败: {str(e)}")

@router.post("/order/files", summary="更新文件顺序")
async def update_file_order(request: UpdateFileOrderRequest):
    """更新文件顺序"""
    try:
        await file_service.update_file_order(
            request.file_paths,
            request.directory_path
        )
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"更新文件顺序失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新文件顺序失败: {str(e)}")

@router.post("/order/folders", summary="更新文件夹顺序")
async def update_folder_order(request: UpdateFolderOrderRequest):
    """更新文件夹顺序"""
    try:
        await file_service.update_folder_order(
            request.folder_paths,
            request.directory_path
        )
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"更新文件夹顺序失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新文件夹顺序失败: {str(e)}")

# 文件列表API端点
@router.get("/list", summary="获取文件列表", response_model=dict)
async def list_novel_files():
    """获取novel目录下所有文件"""
    try:
        result = await file_service.list_novel_files()
        return result
    except Exception as e:
        logger.error(f"获取文件列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")

@router.get("/tree", summary="获取文件树", response_model=dict)
async def get_file_tree():
    """获取文件树结构"""
    try:
        chapters = await file_service.list_chapters()
        return chapters
    except Exception as e:
        logger.error(f"获取文件树失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件树失败: {str(e)}")

# 图片上传API端点
@router.post("/upload/image", summary="上传图片", response_model=dict)
async def upload_image(file: UploadFile = FastAPIFile(...)):
    """上传图片文件"""
    try:
        result = await image_upload_service.upload_file(file)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"图片上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"图片上传失败: {str(e)}")

@router.post("/upload/image/base64", summary="上传Base64图片", response_model=dict)
async def upload_base64_image(request: UploadBase64ImageRequest):
    """上传Base64格式的图片"""
    try:
        result = await image_upload_service.upload_from_base64(request.data, request.filename)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Base64图片上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Base64图片上传失败: {str(e)}")

@router.get("/upload/images", summary="获取已上传图片列表", response_model=list)
async def list_uploaded_images():
    """获取已上传的图片列表"""
    try:
        files = await image_upload_service.list_uploaded_files()
        return files
    except Exception as e:
        logger.error(f"获取图片列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取图片列表失败: {str(e)}")

@router.delete("/upload/images/{filename}", summary="删除上传的图片", response_model=dict)
async def delete_uploaded_image(filename: str):
    """删除已上传的图片"""
    try:
        result = await image_upload_service.delete_file(filename)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除图片失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除图片失败: {str(e)}")

# 基础文件操作API端点
@router.get("/read/{file_path:path}", summary="读取文件", response_model=dict)
async def read_file(file_path: str):
    """读取文件内容"""
    try:
        content = await file_service.read_file(file_path)
        return {
            "path": file_path,
            "content": content
        }
    except Exception as e:
        logger.error(f"读取文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"读取文件失败: {str(e)}")

@router.put("/write/{file_path:path}", summary="写入文件")
async def write_file(file_path: str, request: WriteFileRequest):
    """写入文件内容"""
    try:
        await file_service.write_file(file_path, request.content)
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"写入文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"写入文件失败: {str(e)}")