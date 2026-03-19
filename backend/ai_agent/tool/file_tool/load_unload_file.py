from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.config.config import settings


class LoadUnloadFileInput(BaseModel):
    file_path: str = Field(description="文件路径")


@tool(args_schema=LoadUnloadFileInput)
async def load_unload_file(file_path: str) -> str:
    """
加载或卸载文件到系统提示词。

功能说明：
- 如果文件不在[额外文件内容]列表中，使用此工具可以将该文件的内容加载到系统提示词，从此会自动订阅更新，保持最新内容，无需重复读取文件
- 如果文件已在[额外文件内容]列表中：使用此工具可以卸载文件内容，取消订阅，节省上下文
- 建议及时卸载用不到的文件订阅，只加载一到四个文件，避免系统提示词膨胀
使用示例：
{
  "file_path": "第一章.md"
}
    """
    try:
        # 获取当前模式
        current_mode = settings.get_config("currentMode", default="outline")
        
        # 获取当前模式的 additionalInfo 列表
        additional_info = settings.get_config("mode", current_mode, "additionalInfo", default=[])
        
        # 确保 additional_info 是列表
        if not isinstance(additional_info, list):
            additional_info = []
        
        # 检查文件是否已在 additionalInfo 中
        if file_path in additional_info:
            # 文件已存在，执行卸载操作
            additional_info.remove(file_path)
            
            # 更新配置
            settings.update_config(additional_info, "mode", current_mode, "additionalInfo")
            
            return f"【工具结果】：成功卸载文件 '{file_path}'，该文件内容将不再包含在系统提示词中"
        else:
            # 文件不存在，执行加载操作
            # 添加到 additionalInfo 列表
            additional_info.append(file_path)
            
            # 更新配置
            settings.update_config(additional_info, "mode", current_mode, "additionalInfo")
            
            return f"【工具结果】：成功加载文件 '{file_path}' 到系统提示词，下次对话时该文件内容将自动包含在系统提示词中"
            
    except Exception as e:
        return f"【工具结果】：操作失败: {str(e)}"
