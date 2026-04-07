import os
import sys
from pathlib import Path

# 配置 GitPython 使用打包的 git 可执行文件
def setup_portable_git():
    """检测并使用便携版 Git（便携 Python 模式）"""
    script_dir = Path(sys.argv[0]).parent.resolve()
    git_exe = script_dir / 'bin' / 'PortableGit' / 'mingw64' / 'bin' / 'git.exe'
    if git_exe.exists():
        os.environ['GIT_PYTHON_GIT_EXECUTABLE'] = str(git_exe)
        os.environ['GIT_PYTHON_REFRESH'] = 'quiet'
        # 同时添加到 PATH
        git_bin = git_exe.parent
        os.environ['PATH'] = str(git_bin) + os.pathsep + os.environ.get('PATH', '')
        return True
    return False

setup_portable_git()

# 添加项目根目录到 sys.path（确保便携环境中能正确导入 backend）
script_dir = Path(__file__).parent.resolve()
if str(script_dir) not in sys.path:
    sys.path.insert(0, str(script_dir))

# 禁用 LiteLLM 自动获取模型价格信息
os.environ["LITELLM_LOG"] = "ERROR"

import logging

# 先初始化数据目录和文件（必须在导入 settings 之前）
from backend.settings.initializer import initialize_directories_and_files
initialize_directories_and_files()

# 初始化完成后再导入 settings
from backend import settings

# 获取静态文件目录路径（支持开发环境和便携 Python 环境）
def get_static_dir():
    # 优先使用相对于脚本的路径（便携 Python 环境）
    script_dir = Path(sys.argv[0]).parent.resolve()
    static_from_script = script_dir / 'static'
    if static_from_script.exists():
        return static_from_script
    # 开发环境：当前工作目录
    return Path('static').resolve()

static_dir = get_static_dir()

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

from backend import chat_router, history_router, file_router, config_router, knowledge_router, model_router, mode_router, mcp_router, checkpoint_router, ws_router

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
        "http://127.0.0.1:3000",
        "file://"  # 允许 Electron 本地文件协议
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 挂载数据文件目录
data_dir = settings.DATA_DIR
app.mount("/data", StaticFiles(directory=data_dir), name="data")

# 挂载静态文件目录（用于离线 Swagger UI）
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

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
app.include_router(knowledge_router)
app.include_router(model_router)
app.include_router(mode_router)
app.include_router(mcp_router)
app.include_router(checkpoint_router)
app.include_router(ws_router)

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
        content={"detail": str(exc)}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理器"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail)}
    )


if __name__ == "__main__":
    try:
        # 启动服务器
        logger.info("后端运行中......")
        
        if getattr(sys, 'frozen', False):
            # 打包环境：直接传递 app 对象，禁用 reload
            uvicorn.run(
                app,
                host=settings.HOST,
                port=settings.PORT,
                reload=False,
                log_level="warning",
                access_log=False
            )
        else:
            # 开发环境：使用模块路径，启用 reload
            uvicorn.run(
                "main:app",
                host=settings.HOST,
                port=settings.PORT,
                reload=True,
                log_level="warning",
                access_log=False
            )
    except Exception as e:
        logger.error(f"服务器启动失败: {e}")
        sys.exit(1)
