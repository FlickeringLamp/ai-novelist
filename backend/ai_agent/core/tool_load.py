from backend.config.config import settings
from backend.ai_agent.tool.embedding_tool.emb_search import search_embedding, list_base_files
from backend.ai_agent.tool.file_tool.read_file import read_file
from backend.ai_agent.tool.file_tool.write_file import write_file
from backend.ai_agent.tool.file_tool.apply_diff import apply_diff
from backend.ai_agent.tool.file_tool.insert_content import insert_content
from backend.ai_agent.tool.file_tool.search_file import search_file
from backend.ai_agent.tool.file_tool.search_and_replace import search_and_replace
from backend.ai_agent.tool.operation_tool.ask_user import ask_user_question
from backend.ai_agent.mcp.mcp_manager import get_mcp_tools_as_objects

async def import_tools(mode: str = None):
    """导入所有工具，包括内置工具和MCP工具
    
    Args:
        mode: 模式名称，如果提供则只导入该模式启用的工具
    """
    # 内置工具字典
    builtin_tools = {
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
    
    # 获取MCP工具对象
    mcp_tools = await get_mcp_tools_as_objects()
    
    # 根据模式过滤工具
    if mode:
        # 获取模式启用的工具列表
        enabled_tools = settings.get_config("mode", mode, "tools", default=[])
        print(f"[INFO] 模式 '{mode}' 启用的工具: {enabled_tools}")
        # 只返回该模式启用的工具
        builtin_tools = {tool_name: builtin_tools[tool_name] for tool_name in enabled_tools if tool_name in builtin_tools}
    
    # 合并MCP工具和内置工具
    tools = mcp_tools.copy()
    tools.update(builtin_tools)
    
    for tool_name in tools:
        print(f"[OK] 已导入工具: {tool_name}")
    
    print(f"[INFO] 总共导入 {len(tools)} 个工具")
    return tools
