from backend.settings.settings import settings
from backend.ai_agent.tool.rag_tool.rag_search import rag_search
from backend.ai_agent.tool.rag_tool.rag_list_files import rag_list_files
from backend.ai_agent.tool.file_tool.load_unload_file import load_unload_file
from backend.ai_agent.tool.file_tool.manage_file import manage_file
from backend.ai_agent.tool.file_tool.apply_diff import apply_diff
from backend.ai_agent.tool.file_tool.search_text import search_text
from backend.ai_agent.tool.operation_tool.ask_user import ask_user_question
from backend.ai_agent.tool.operation_tool.execute_command import execute_command
from backend.ai_agent.tool.skill_tool.load_unload_skill import load_unload_skill
from backend.ai_agent.mcp.mcp_manager import get_mcp_tools_as_objects


async def import_tools(mode: str = None):
    """导入所有工具，包括内置工具和MCP工具
    
    MCP工具名称格式: mcp--<server_id>--<tool_name>
    内置工具名称格式: <tool_name>
    """
    # 内置工具字典
    builtin_tools = {
        "rag_search": rag_search,
        "rag_list_files": rag_list_files,
        "load_unload_file": load_unload_file,
        "manage_file": manage_file,
        "apply_diff": apply_diff,
        "search_text": search_text,
        "ask_user_question": ask_user_question,
        "execute_command": execute_command,
        "load_unload_skill": load_unload_skill
    }
    
    # 获取所有MCP工具对象（名称已添加前缀: mcp--<server_id>--<tool_name>）
    # MCP工具不受模式限制，始终加载所有激活服务器的工具
    mcp_tools = await get_mcp_tools_as_objects()
    
    # 根据模式过滤内置工具
    if mode:
        # 获取模式启用的工具列表
        enabled_tools = settings.get_config("mode", mode, "tools", default=[])
        print(f"[INFO] 模式 '{mode}' 启用的工具: {enabled_tools}")
        # 只保留启用的内置工具
        builtin_tools = {tool_name: builtin_tools[tool_name] for tool_name in enabled_tools if tool_name in builtin_tools}
    
    # 合并所有工具：内置工具 + MCP工具
    tools = {}
    tools.update(builtin_tools)
    tools.update(mcp_tools)
    
    for tool_name in tools:
        print(f"[OK] 已导入工具: {tool_name}")
    
    print(f"[INFO] 总共导入 {len(tools)} 个工具 (MCP: {len(mcp_tools)}, 内置: {len(builtin_tools)})")
    return tools
