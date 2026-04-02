from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.settings.settings import settings
from backend.file.file_service import normalize_to_absolute, read_file as file_service_read_file
from backend.ai_agent.utils.file_utils import format_file_with_hashes


class LoadUnloadFileInput(BaseModel):
    file_path: str = Field(description="文件路径")


@tool(args_schema=LoadUnloadFileInput)
async def load_unload_file(file_path: str) -> str:
    """
加载或卸载文件到AI上下文中
你可以认为这是加强版的"读取文件内容"工具
功能说明：
- 如果文件不在[额外文件内容]列表中，使用此工具可以将该文件的内容加载到末尾附加消息，从此会自动订阅更新，保持最新内容，无需重复读取文件
- 如果文件已在[额外文件内容]列表中：使用此工具可以卸载文件内容，取消订阅，节省上下文
- 将文件加载后，文件内容将会显示为"虚拟id|实际内容"，注意，虚拟id不真实存在于实际文件，无法被搜索和改写
- 推荐加载1-5个文件，过多的订阅会导致上下文膨胀，建议及时卸载用不到的订阅
使用示例（支持绝对路径/相对路径）：
{
  "file_path": "第一章.md"
}
    """
    try:
        # 将路径转换为绝对路径（统一存储格式）
        abs_path = normalize_to_absolute(file_path)
        
        # 获取当前模式
        current_mode = settings.get_config("currentMode", default="管家agent")
        
        # 获取当前模式的 additionalInfo 列表
        additional_info = settings.get_config("mode", current_mode, "additionalInfo", default=[])
        
        # 确保 additional_info 是列表
        if not isinstance(additional_info, list):
            additional_info = []
        # 检查文件是否已在 additionalInfo 中
        if abs_path in additional_info:
            # 文件已存在，执行卸载操作
            additional_info.remove(abs_path)
            
            # 更新配置
            settings.update_config(additional_info, "mode", current_mode, "additionalInfo")
            
            return f"【工具结果】：成功卸载文件 '{abs_path}'"
        else:
            # 文件不存在，执行加载操作
            # 添加到 additionalInfo 列表
            additional_info.append(abs_path)
            
            # 更新配置
            settings.update_config(additional_info, "mode", current_mode, "additionalInfo")
            
            return f"【工具结果】：成功加载文件 '{abs_path}' 到末尾附加消息"
            
    except Exception as e:
        return f"【工具结果】：操作失败: {str(e)}"
