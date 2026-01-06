import sqlite3
import logging
from typing import Optional


logger = logging.getLogger(__name__)
# 全局数据库连接和内存存储，避免重复创建连接
_db_connection = None
_memory_storage = {}
_is_shutting_down = False
##：+ _db_schema_initialized + def _ensure_db_schema_initialized
_db_schema_initialized = False


def _ensure_db_schema_initialized(conn: sqlite3.Connection) -> None:
    """确保 LangGraph SqliteSaver 所需表已创建"""
    global _db_schema_initialized
    if _db_schema_initialized:
        return
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver
        saver = SqliteSaver(conn)
        saver.setup()
        _db_schema_initialized = True
        logger.info("检查点数据库表已初始化")
    except Exception as e:
        logger.error(f"初始化检查点数据库表失败: {e}")
        raise

def get_db_connection():
    """获取全局数据库连接，避免多连接导致的锁定问题"""
    global _db_connection, _is_shutting_down
    
    if _is_shutting_down:
        raise RuntimeError("系统正在关闭，无法获取数据库连接")
    
    if _db_connection is None:
        # 确保数据库目录存在
        from backend.config import settings
        _db_connection = sqlite3.connect(settings.CHECKPOINTS_DB_PATH, check_same_thread=False)
        # 设置更长的超时时间，默认5秒可能不够
        _db_connection.execute("PRAGMA busy_timeout = 30000")  # 30秒超时
        # 启用WAL模式，提高并发性能
        _db_connection.execute("PRAGMA journal_mode=WAL")
        # 设置同步模式为NORMAL，在性能和安全性之间取得平衡
        _db_connection.execute("PRAGMA synchronous = NORMAL")
        logger.info(f"数据库连接已建立: {settings.CHECKPOINTS_DB_PATH}")
        ##:+1
        _ensure_db_schema_initialized(_db_connection)
    
    # 检查连接是否已关闭
    try:
        _db_connection.execute("SELECT 1")
    except sqlite3.ProgrammingError as e:
        if "Cannot operate on a closed database" in str(e):
            logger.warning("数据库连接已关闭，重新创建连接")
            from backend.config import settings
            _db_connection = sqlite3.connect(settings.CHECKPOINTS_DB_PATH, check_same_thread=False)
            _db_connection.execute("PRAGMA busy_timeout = 30000")  # 30秒超时
            _db_connection.execute("PRAGMA journal_mode=WAL")
            _db_connection.execute("PRAGMA synchronous = NORMAL")
            ##:+#+3
            # 连接重建后需要重新初始化schema
            global _db_schema_initialized
            _db_schema_initialized = False
            _ensure_db_schema_initialized(_db_connection)
        else:
            raise
    return _db_connection

def close_db_connection():
    """安全关闭数据库连接"""
    global _db_connection, _is_shutting_down, _memory_storage
    
    _is_shutting_down = True
    
    if _db_connection:
        try:
            # 清理内存存储
            _memory_storage.clear()
            
            # 执行检查点操作，确保WAL文件中的数据写入主数据库
            _db_connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            
            # 关闭连接
            _db_connection.close()
            _db_connection = None
            logger.info("数据库连接已安全关闭")
        except Exception as e:
            logger.error(f"关闭数据库连接时发生错误: {e}")

def get_memory_storage(mode: Optional[str] = None):
    """获取或创建内存存储，避免重复创建"""
    from langgraph.checkpoint.sqlite import SqliteSaver
    
    if mode not in _memory_storage:
        conn = get_db_connection()
        try:
            _memory_storage[mode] = SqliteSaver(conn)
            logger.info(f"内存存储已创建，模式: {mode}")
        except Exception as e:
            logger.error(f"创建内存存储失败: {e}")
            # 如果创建失败，尝试重置连接并重试
            global _db_connection
            _db_connection = None
            conn = get_db_connection()
            _memory_storage[mode] = SqliteSaver(conn)
    
    return _memory_storage[mode]