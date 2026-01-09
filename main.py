import sys
import logging

from backend.config import settings, initialize_directories_and_files

# 初始化数据目录和文件
initialize_directories_and_files()

# 配置日志（在导入其他模块之前，确保所有日志都能被正确捕获）
log_level_map = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL
}
log_level = log_level_map.get(settings.LOG_LEVEL.upper(), logging.INFO)

logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html

from backend.api.chat_api import router as chat_router
from backend.api.history_api import router as history_router
from backend.api.file_api import router as file_router
from backend.api.config_api import router as config_router
from backend.api.embedding_api import router as embedding_router
from backend.api.provider_api import router as model_router

# 创建FastAPI应用，禁用默认文档，使用自定义离线文档
app = FastAPI(
    title="AI Novelist Backend",
    description="""
    愿青年摆脱冷气，只是向上走。
    有一分热，发一分光，就令萤火一般，
    不必等候烛火
    """,
    version="0.1.0",
    docs_url=None,  # 禁用默认的 Swagger UI，使用自定义路由
    redoc_url=None,  # 禁用默认的 ReDoc
)

# 配置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 挂载数据文件目录
data_dir = settings.DATA_DIR
app.mount("/data", StaticFiles(directory=data_dir), name="data")

# 挂载静态文件目录（用于离线 Swagger UI）
app.mount("/static", StaticFiles(directory="static"), name="static")

# 自定义 Swagger UI 路由
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Swagger UI",
        swagger_js_url="/static/swagger-ui/swagger-ui-bundle.js",
        swagger_css_url="/static/swagger-ui/swagger-ui.css",
        swagger_ui_parameters={
            "syntaxHighlight.theme": "obsidian", # 黑色主题
            "tryItOutEnabled": True, # try-it-out开关
            "displayRequestDuration": True # 请求耗时
        }
    )

# 包含API路由
app.include_router(chat_router)
app.include_router(history_router)
app.include_router(file_router)
app.include_router(config_router)
app.include_router(embedding_router)
app.include_router(model_router)

# 健康检查端点

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "message": "AI Novelist Python Backend is running",
        "host": settings.HOST,
        "port": settings.PORT
    }

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理器"""
    return JSONResponse(
        status_code=500,
        content=str(exc)
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理器"""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail
    )


if __name__ == "__main__":
    try:
        # 启动服务器
        logger.info("后端运行中......")
        uvicorn.run(
            "main:app",
            host=settings.HOST,
            port=settings.PORT,
            reload=False,  # 禁用重载机制，避免双重启动
            log_level="warning",  # 减少uvicorn的日志输出
            access_log=False  # 禁用访问日志
        )
    except Exception as e:
        logger.error(f"服务器启动失败: {e}")
        sys.exit(1)
