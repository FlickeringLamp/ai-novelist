import re
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.file.file_service import search_files_for_ai, read_file as file_service_read_file, update_file as file_service_update_file


class SearchTextInput(BaseModel):
    path: Optional[str] = Field(default=None, description="搜索路径，为null则搜索整个项目")
    pattern: str = Field(description="搜索模式，支持正则表达式，参考Python re模块语法")
    replace: Optional[str] = Field(default=None, description="替换文本，为null则只搜索不替换")


@tool(args_schema=SearchTextInput)
async def search_text(path: Optional[str] = None, pattern: str = None, replace: Optional[str] = None) -> str:
    """
搜索文本，支持在文件或文件夹内搜索，也支持在单个文件内搜索并替换

使用示例：
1. 在整个项目中搜索（null而非"null"）
{
  "path": null,
  "pattern": "张三"
}
2. 在单个文件中搜索
{
  "path": "第一章.md",
  "pattern": "张三"
}
3. 在单个文件中搜索并替换
{
  "path": "第一章.md",
  "pattern": "\\d{4}年\\d{1,2}月\\d{1,2}日",
  "replace": "2024年1月1日"
}
==注意！此工具不可用于删除空行。==
    """
    try:
        # 判断是文件搜索还是项目搜索
        is_single_file = path and Path(path).suffix != ''
        
        if replace is None:
            # 只搜索模式
            if is_single_file:
                # 单文件搜索：读取内容并匹配
                content = await file_service_read_file(path)
                regex = re.compile(pattern)
                matches = list(regex.finditer(content))
                
                if not matches:
                    return f"【工具结果】：在文件 '{path}' 中未找到匹配项"
                
                # 限制最大结果数
                max_results = 100
                total_matches = len(matches)
                is_truncated = total_matches > max_results
                
                # 构建匹配结果展示
                lines = content.split('\n')
                results = []
                for match in matches[:max_results]:
                    # 找到匹配所在的行号
                    pos = match.start()
                    line_num = content[:pos].count('\n') + 1
                    line_content = lines[line_num - 1] if line_num <= len(lines) else ""
                    results.append(f"行{line_num}: {line_content}")
                
                result_text = '\n'.join(results)
                
                # 如果被截断，添加提示信息
                if is_truncated:
                    truncated_count = total_matches - max_results
                    result_text += f"\n\n[提示：检索结果被折叠了 {truncated_count} 个匹配项。建议使用更精确的检索词以减少检索范围]"
                
                return f"【工具结果】：在 '{path}' 中找到 {total_matches} 个匹配项：\n\n{result_text}"
            else:
                # 多文件搜索：使用原有搜索服务
                display_path = path if path else "根目录"
                results = await search_files_for_ai(pattern)
                
                if results:
                    return f"【工具结果】：在 '{display_path}' 中找到匹配项：\n\n{results}"
                else:
                    return f"【工具结果】：在 '{display_path}' 中没有找到匹配项"
        else:
            # 搜索并替换模式（只能对单文件操作）
            if not is_single_file:
                return "【工具结果】：替换操作必须指定具体文件路径"
            
            content = await file_service_read_file(path)
            regex = re.compile(pattern)
            new_content = regex.sub(replace, content)
            
            # 检查是否有实际替换
            if new_content == content:
                return f"【工具结果】：在文件 '{path}' 中未找到匹配项，无内容被替换"
            
            await file_service_update_file(path, new_content)
            
            # 统计替换次数
            match_count = len(regex.findall(content))
            return f"【工具结果】：在文件 '{path}' 中成功完成搜索替换，共替换 {match_count} 处"
    
    except Exception as e:
        return f"【工具结果】：操作失败: {str(e)}"
