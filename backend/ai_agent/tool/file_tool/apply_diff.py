from pydantic import BaseModel, Field
from typing import List, Optional, Union
from langchain.tools import tool
from langgraph.types import interrupt
from backend.file.file_service import read_file as file_service_read_file
from backend.file.file_service import update_file as file_service_update_file
from backend.ai_agent.utils.file_utils import split_paragraphs
from rapidfuzz import distance as rapidfuzz_distance


# ==================== 文本处理辅助函数 ====================

# 智能引号和排版字符映射
NORMALIZATION_MAPS = {
    # 智能引号转换为普通引号
    '\u201C': '"',  # 左双引号 (U+201C)
    '\u201D': '"',  # 右双引号 (U+201D)
    '\u2018': "'",  # 左单引号 (U+2018)
    '\u2019': "'",  # 右单引号 (U+2019)
    # 排版字符转换
    '\u2026': "...",  # 省略号
    '\u2014': "-",   # 长破折号
    '\u2013': "-",   # 短破折号
    '\u00A0': " ",   # 不换行空格
}

def normalize_text(text: str) -> str:
    """
    增强的文本归一化函数
    
    处理：
    - 智能引号（" " ' '）→ 普通引号
    - 排版字符（… — –）→ 普通字符
    - 多余空格压缩
    - 大小写转换
    """
    # 替换智能引号和排版字符
    for special, normal in NORMALIZATION_MAPS.items():
        text = text.replace(special, normal)
    
    # 压缩多余空格并转换为小写
    return ' '.join(text.lower().split())

def get_similarity(original: str, search: str) -> float:
    """
    计算两个字符串之间的相似度
    
    使用rapidfuzz库进行高效的Levenshtein距离计算
    """
    if search == "":
        return 0.0
    
    # 使用增强的文本归一化
    normalized_original = normalize_text(original)
    normalized_search = normalize_text(search)
    
    if normalized_original == normalized_search:
        return 1.0
    
    # 使用rapidfuzz计算Levenshtein距离
    dist = rapidfuzz_distance.Levenshtein.normalized_similarity(normalized_original, normalized_search)
    
    return dist


class LineReplacement(BaseModel):
    """单段替换操作"""
    paragraph: int = Field(description="段落号", ge=1)
    old: str = Field(description="要替换的原始内容（单段文本）")
    new: Optional[str] = Field(default=None, description="替换后的新内容（单段文本），不填写此字段时表示删除该段，空字符串表示将段变为空段")


class ApplyDiffInput(BaseModel):
    """应用差异的输入参数"""
    path: str = Field(description="文件路径")
    replacements: List[LineReplacement] = Field(description="替换操作列表，每个包含段落号、原始内容和新内容")


@tool(args_schema=ApplyDiffInput)
async def apply_diff(path: str, replacements: List[LineReplacement]) -> str:
    """应用差异修改
    
    使用段落号定位并替换内容
    
    参数格式：
    {
        "path": "第一章.md",
        "replacements": [
            {
                "paragraph": 10,
                "old": "原始内容",
                "new": "新内容"
            },
            {
                "paragraph": 25,
                "old": "要删除的内容"
            },
            {
                "paragraph": 30,
                "old": "要换成空段的内容",
                "new": ""
            }
        ]
    }
    
    重要说明：
    1. paragraph 指定段落号
    2. old 必须与文件中指定位置的内容完全匹配
    3. new 将替换 old 的所有内容，不填写new字段时删除该段，new为空字符串时清空该段
    4. 支持最低一个替换块，到多个替换块(上不封顶)
    5. 当使用该工具**删除**文本后，建议使用read_file工具重新读取内容，因为删除n段后，该段数往后的文本会向上偏移n段，paragraph不再准确。
    
    Args:
        path: 文件路径
        replacements: 替换操作列表
    """
    # 构造包含工具具体信息的中断数据
    interrupt_data = {
        "tool_name": "apply_diff",
        "tool_display_name": "应用差异",
        "description": f"应用差异: {path}",
        "parameters": {
            "path": path,
            "replacements": [{"paragraph": r.paragraph, "old": r.old[:50] + "..." if len(r.old) > 50 else r.old, "new": r.new[:50] + "..." if r.new is not None and len(r.new) > 50 else r.new} for r in replacements]
        }
    }
    user_choice = interrupt(interrupt_data)
    print(f"用户选择{user_choice}")
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            original_content = await file_service_read_file(path)
            
            # 使用统一的段落分割函数
            paragraphs, paragraph_ending = split_paragraphs(original_content)
            
            # 按段落号排序，删除操作需要从后往前处理以避免段落号偏移
            sorted_replacements = sorted(replacements, key=lambda x: x.paragraph, reverse=True)
            
            applied_count = 0
            fail_parts = []
            
            for replacement in sorted_replacements:
                paragraph_num = replacement.paragraph
                old_content = replacement.old
                new_content = replacement.new
                
                # 转换为0-based索引
                index = paragraph_num - 1
                
                # 检查段落号是否有效
                if index < 0 or index >= len(paragraphs):
                    fail_parts.append({
                        "success": False,
                        "error": f"段落号 {paragraph_num} 超出文件范围（文件共 {len(paragraphs)} 段）"
                    })
                    continue
                
                # 获取文件中的实际内容
                actual_content = paragraphs[index]
                
                # 使用相似度验证内容是否匹配（默认阈值0.9）
                similarity = get_similarity(actual_content, old_content)
                similarity_threshold = 0.9
                
                if similarity < similarity_threshold:
                    fail_parts.append({
                        "success": False,
                        "error": f"段 {paragraph_num} 的内容不匹配（相似度: {similarity:.2f}, 阈值: {similarity_threshold}）\n期望: {old_content}\n实际: {actual_content}"
                    })
                    continue
                
                # 执行替换或删除
                if new_content is None:
                    # 删除该段
                    del paragraphs[index]
                else:
                    # 替换该段
                    paragraphs[index] = new_content
                applied_count += 1
            
            # 检查应用结果
            if applied_count == 0:
                error_details = "\n".join([part["error"] for part in fail_parts])
                return f"【工具结果】：应用差异失败: 未应用任何更改。所有替换操作都失败了。\n失败详情:\n{error_details} ;**【用户信息】：{choice_data}**"
            
            # 写入修改后的内容
            new_content = paragraph_ending.join(paragraphs)
            await file_service_update_file(path, new_content)
            
            success_msg = f"【工具结果】：差异已成功应用到文件 '{path}'，应用了 {applied_count} 个更改 ;**【用户信息】：{choice_data}**"
            if fail_parts:
                error_details = "\n".join([part["error"] for part in fail_parts])
                success_msg += f"\n【工具结果】： {len(fail_parts)} 个更改失败:\n{error_details} ;**【用户信息】：{choice_data}**"
            
            return success_msg
        except Exception as e:
            return f"【工具结果】：应用差异失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户取消了工具 ;**【用户信息】：{choice_data}**"
