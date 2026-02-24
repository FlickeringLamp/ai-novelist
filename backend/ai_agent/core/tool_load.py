from backend.config.config import settings
from backend.ai_agent.tool.embedding_tool.emb_search import search_embedding, list_base_files
from backend.ai_agent.tool.file_tool.read_file import read_file
from backend.ai_agent.tool.file_tool.write_file import write_file
from backend.ai_agent.tool.file_tool.apply_diff import apply_diff
from backend.ai_agent.tool.file_tool.insert_content import insert_content
from backend.ai_agent.tool.file_tool.search_file import search_file
from backend.ai_agent.tool.file_tool.search_and_replace import search_and_replace
from backend.ai_agent.tool.operation_tool.ask_user import ask_user_question


def import_tools_from_directory(tool_dir: str, mode: str = None):
    """直接导入所有工具，支持按模式过滤
    
    Args:
        tool_dir: 工具目录（未使用，保留参数兼容性）
        mode: 模式名称，如果提供则只导入该模式启用的工具
    """
    # 所有可用工具的字典
    all_tools = {
        "search_embedding": search_embedding,
        "list_base_files": list_base_files,
        "read_file": read_file,
        "write_file": write_file,
        "apply_diff": apply_diff,
        "insert_content": insert_content,
        "search_file": search_file,
        "search_and_replace": search_and_replace,
        "ask_user_question": ask_user_question
    }
    
    # 根据模式过滤工具
    if mode:
        # 获取模式启用的工具列表
        enabled_tools = settings.get_config("mode", mode, "tools", default=[])
        print(f"[INFO] 模式 '{mode}' 启用的工具: {enabled_tools}")
        # 只返回该模式启用的工具
        tools = {tool_name: all_tools[tool_name] for tool_name in enabled_tools if tool_name in all_tools}
    else:
        # 如果没有指定模式，返回所有工具
        tools = all_tools
    
    for tool_name in tools:
        print(f"[OK] 已导入工具: {tool_name}")
    
    print(f"[INFO] 总共导入 {len(tools)} 个工具")
    return tools
