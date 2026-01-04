import os
import signal
import sys
import atexit
import uvicorn

# 添加ai-novelist根目录到Python路径
sys.path.insert(0, os.path.abspath(os.getcwd()))
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.api.chat_api import router as chat_router
from backend.api.history_api import router as history_router
from backend.api.file_api import router as file_router
from backend.api.config_api import router as config_router
from backend.api.embedding_api import router as embedding_router
from backend.api.provider_api import router as model_router

from backend.core.ai_agent.utils.db_utils import close_db_connection

# 创建FastAPI应用
app = FastAPI(
    title="AI Novelist Backend",
    description="""
    愿青年摆脱冷气，只是向上走。
    有一分热，发一分光，就令萤火一般，
    不必等候烛火
    """,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    # 配置离线模式，避免CDN资源加载问题
    swagger_ui_parameters={
        "syntaxHighlight.theme": "obsidian",
        "tryItOutEnabled": True,
        "displayRequestDuration": True
    }
)

# 配置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React开发服务器
        "http://127.0.0.1:3000",
        "http://localhost:5173",  # Vite开发服务器
        "http://127.0.0.1:5173",
        "http://localhost:5500", # 测试页面
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件目录
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# 挂载上传文件目录
uploads_dir = os.path.join(os.path.dirname(__file__), "backend", "data", "uploads")
# 确保上传目录存在
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# 包含API路由
app.include_router(chat_router)
app.include_router(history_router)
app.include_router(file_router)
app.include_router(config_router)
app.include_router(embedding_router)
app.include_router(model_router)

# 健康检查端点
@app.get("/")
async def root():
    """根端点，用于健康检查"""
    return {
        "message": "AI Novelist Python Backend is running",
        "version": "0.1.0",
        "status": "healthy"
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "message": "AI Novelist Python Backend is running",
        "backend_type": "python",
        "host": settings.HOST,
        "port": settings.PORT
    }

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理器"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "服务器内部错误",
            "detail": str(exc)
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理器"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail
        }
    )


# 配置日志
import logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 优雅关闭处理
def cleanup_resources():
    """清理资源，确保数据库连接正确关闭"""
    logger.info("正在清理资源...")
    try:
        # 关闭数据库连接
        close_db_connection()
        
        # 清理WAL文件
        db_path = "backend/checkpoints.db"
        wal_path = f"{db_path}-wal"
        shm_path = f"{db_path}-shm"
        
        for temp_file in [wal_path, shm_path]:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    logger.info(f"已清理临时文件: {temp_file}")
                except Exception as exist_err:
                    logger.warning(f"清理临时文件失败 {temp_file}: {exist_err}")
        
        logger.info("资源清理完成")
    except Exception as e:
        logger.error(f"资源清理过程中发生错误: {e}")

def signal_handler(signum, frame):
    """信号处理器"""
    logger.info(f"收到信号 {signum}，正在优雅关闭...")
    cleanup_resources()
    sys.exit(0)

# 注册信号处理器
signal.signal(signal.SIGINT, signal_handler)  # Ctrl+C
signal.signal(signal.SIGTERM, signal_handler) # 终止信号

# 注册退出时的清理函数
atexit.register(cleanup_resources)

if __name__ == "__main__":
    try:
        # 启动服务器
        logger.info("启动AI Novelist后端服务...")
        uvicorn.run(
            "main:app",
            host=settings.HOST,
            port=settings.PORT,
            reload=False,  # 禁用重载机制，避免双重启动
            log_level="warning",  # 减少uvicorn的日志输出
            access_log=False  # 禁用访问日志
        )
    except KeyboardInterrupt:
        logger.info("收到键盘中断，正在优雅关闭...")
        cleanup_resources()
    except Exception as e:
        logger.error(f"服务器启动失败: {e}")
        cleanup_resources()
        sys.exit(1)
