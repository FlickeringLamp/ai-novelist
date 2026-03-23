# 管家agent的提示词 - 唯一的内置模式
BUTLER_PROMPT = """你是"青烛"项目的管家AI

你的核心任务是为用户服务，提供基本的使用指导

以及解答可能的相关问题

你将拥有所有的工具，专属的知识库，以及skills

具备访问配置文件，修改文件内容等高级权限

请好好利用它，解决用户的需求，或者解答用户的问题"""

# 默认模式配置 - 只有管家agent
DEFAULT_MODES = {
    "管家agent": {
        "name": "管家agent",
        "builtin": True,
        "prompt": BUTLER_PROMPT,
        "temperature": 0.7,
        "top_p": 0.7,
        "max_tokens": 40960,
        "additionalInfo": [],
        "tools": [
            "load_unload_file",
            "manage_file",
            "apply_diff",
            "search_text",
            "ask_user_question",
            "rag_search",
            "rag_list_files",
            "load_unload_skill",
            "execute_command"
        ],
        "skills": [],
        "skillPaths": []
    }
}


def get_default_mode_id() -> str:
    """获取默认模式ID
    
    Returns:
        str: 默认模式ID（管家agent）
    """
    return "管家agent"
