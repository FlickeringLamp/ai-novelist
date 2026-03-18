from pydantic import BaseModel, Field
from typing import List, Optional
from langchain.tools import tool
from backend.file.file_service import read_file as file_service_read_file
from backend.file.file_service import update_file as file_service_update_file
from backend.ai_agent.utils.file_utils import split_paragraphs
from rapidfuzz import distance as rapidfuzz_distance


# ==================== 文本处理辅助函数 ====================

NORMALIZATION_MAPS = {
    '\u201C': '"', '\u201D': '"',
    '\u2018': "'", '\u2019': "'",
    '\u2026': "...",
    '\u2014': "-", '\u2013': "-",
    '\u00A0': " ",
}

def normalize_text(text: str) -> str:
    for special, normal in NORMALIZATION_MAPS.items():
        text = text.replace(special, normal)
    return ' '.join(text.lower().split())

def get_similarity(original: str, search: str) -> float:
    if search == "":
        return 0.0
    normalized_original = normalize_text(original)
    normalized_search = normalize_text(search)
    if normalized_original == normalized_search:
        return 1.0
    return rapidfuzz_distance.Levenshtein.normalized_similarity(normalized_original, normalized_search)


class LineOperation(BaseModel):
    paragraph: int = Field(description="段落号。插入时：1=开头，大于最大段落=末尾；替换/删除时：指定目标段落")
    old: Optional[str] = Field(default=None, description="原始内容。为null表示插入操作，不为null表示替换/删除操作")
    new: Optional[str] = Field(default=None, description="新内容。为null表示删除操作，不为null表示插入/替换操作")


class ApplyDiffInput(BaseModel):
    path: str = Field(description="文件路径")
    operations: List[LineOperation] = Field(description="操作列表，支持插入(old=null)、替换(old!=null,new!=null)、删除(new=null)")


@tool(args_schema=ApplyDiffInput)
async def apply_diff(path: str, operations: List[LineOperation]) -> str:
    """
段落级文件编辑：插入、替换、删除

使用示例：
1. 在段落5之前插入新内容
{
  "path": "第一章.md",
  "operations": [{"paragraph": 5, "old": null, "new": "新插入的段落内容"}]
}
2. 替换段落10的内容
{
  "path": "第一章.md",
  "operations": [{"paragraph": 10, "old": "原始内容", "new": "新内容"}]
}
3. 删除段落20
{
  "path": "第一章.md",
  "operations": [{"paragraph": 20, "old": "要删除的内容", "new": null}]
}
4. 批量操作
{
  "path": "第一章.md",
  "operations": [
    {"paragraph": 20, "old": "待删", "new": null},
    {"paragraph": 25, "old": "旧内容", "new": "替换段25"},
    {"paragraph": 30, "old": null, "new": "在段30前插入"}
  ]
}
    """
    try:
        original_content = await file_service_read_file(path)
        paragraphs, paragraph_ending = split_paragraphs(original_content)
        
        applied_count = 0
        fail_parts = []
        
        # 按paragraph降序处理，避免索引偏移
        sorted_ops = sorted(operations, key=lambda x: x.paragraph, reverse=True)
        
        for op in sorted_ops:
            para_num = op.paragraph
            old_content = op.old
            new_content = op.new
            index = para_num - 1
            
            # 插入操作：old为null
            if old_content is None:
                if new_content is None:
                    fail_parts.append({"error": f"操作无效：old和new不能同时为null（段落{para_num}）"})
                    continue
                # 1=开头，大于长度=末尾，其他=指定位置前
                insert_pos = 0 if para_num <= 1 else min(index, len(paragraphs))
                paragraphs.insert(insert_pos, new_content)
                applied_count += 1
                continue
            
            # 替换/删除操作：需要验证old内容
            if index < 0 or index >= len(paragraphs):
                fail_parts.append({"error": f"段落{para_num}超出范围（共{len(paragraphs)}段）"})
                continue
            
            actual = paragraphs[index]
            sim = get_similarity(actual, old_content)
            
            if sim < 0.9:
                fail_parts.append({"error": f"段落{para_num}内容不匹配（相似度{sim:.2f}），期望：{old_content[:30]}...，实际：{actual[:30]}..."})
                continue
            
            if new_content is None:
                del paragraphs[index]  # 删除
            else:
                paragraphs[index] = new_content  # 替换
            applied_count += 1
        
        if applied_count == 0:
            errors = "\n".join([p["error"] for p in fail_parts])
            return f"【工具结果】：操作失败，未应用任何更改\n{errors}"
        
        await file_service_update_file(path, paragraph_ending.join(paragraphs))
        
        result = f"【工具结果】：成功应用 {applied_count} 个操作到 '{path}'"
        if fail_parts:
            result += f"\n失败 {len(fail_parts)} 个：\n" + "\n".join([p["error"] for p in fail_parts])
        return result
        
    except Exception as e:
        return f"【工具结果】：操作失败: {str(e)}"
