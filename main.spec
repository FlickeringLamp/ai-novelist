# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# 项目根目录
project_root = Path(SPECPATH)

# 数据收集配置（自动收集所有依赖的数据文件）
datas = []
# 自动收集主要依赖的数据文件
data_packages = ['chromadb', 'langchain', 'langchain_community', 'fastapi']
for package in data_packages:
    try:
        datas += collect_data_files(package)
    except Exception as e:
        print(f"警告: 收集 {package} 的数据文件失败: {e}")

# 手动添加的静态文件
datas += [
    (str(project_root / 'static'), 'static'),
    # 添加本地嵌入模型目录
    (str(project_root / 'models' / 'embedding'), 'models/embedding'),
]

# 隐藏导入（自动收集所有子模块，确保百分百不缺依赖）
hiddenimports = []
# 自动收集所有主要依赖的子模块
packages = [
    'uvicorn',
    'fastapi',
    'langchain',
    'langchain_classic',
    'langchain_core',
    'langchain_community',
    'langchain_openai',
    'langchain_openrouter',
    'langchain_text_splitters',
    'langchain_ollama',
    'ollama',
    'langchain_chroma',
    'langgraph',
    'langgraph_checkpoint_sqlite',
    'chromadb',
    'pydantic',
    'pydantic_core',
    'pydantic_settings',
    'openai',
    'dashscope',
    'aiohttp',
    'httpx',
    'aiosqlite',
    'aiofiles',
    'rapidfuzz',
    'pypdf',
    'python_docx',
    'python_multipart',
    'natsort',
    'pyjwt',
    'nest_asyncio',
    'msgpack',
    'requests',
    'tenacity',
    'anyio',
    'starlette',
    'watchfiles',
    'websockets',
    'pydantic_settings',
    'fsspec',
    'huggingface_hub',
    'tiktoken',
    'openai',
    'langsmith',
    'orjson',
    'jsonpatch',
    'pyyaml',
    'certifi',
    'charset_normalizer',
    'idna',
    'urllib3',
    'sniffio',
    # 本地嵌入模型支持
    'llama_cpp',
]

for package in packages:
    try:
        hiddenimports += collect_submodules(package)
    except Exception as e:
        print(f"警告: 收集 {package} 的子模块失败: {e}")

# 后端模块（手动添加，因为可能不在 pip 安装的包中）
hiddenimports += [
    'backend',
    'backend.ai_agent',
    'backend.ai_agent.core',
    'backend.ai_agent.embedding',
    'backend.ai_agent.embedding.llama_cpp_embeddings',
    'backend.ai_agent.models',
    'backend.ai_agent.tool',
    'backend.ai_agent.tool.embedding_tool',
    'backend.ai_agent.tool.file_tool',
    'backend.ai_agent.tool.operation_tool',
    'backend.ai_agent.utils',
    'backend.api',
    'backend.config',
    'backend.file',
]

# 排除的模块（可选，减小文件体积）
excludes = [
    'tkinter',
    'matplotlib',
    'PIL',
    'IPython',
    'notebook',
    'jupyter',
]

# PyInstaller配置
block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ai-novelist',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # 显示控制台，便于查看日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # 可以指定图标文件路径，如 'icon.ico'
)

# 收集所有文件到输出目录
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend',  # 输出目录名称（dist/backend 目录，方便 Electron 打包）
)
