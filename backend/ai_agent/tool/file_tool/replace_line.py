from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.file.file_service import read_file as file_service_read_file
from backend.file.file_service import update_file as file_service_update_file
from backend.ai_agent.utils.file_utils import split_paragraphs, get_short_hash, parse_id


class ReplaceItem(BaseModel):
    id: str = Field(description="要替换的段落ID（格式：段落号-哈希，如 '3-b2'）")
    new_content: str = Field(description="新的段落内容")


class ReplaceLineInput(BaseModel):
    path: str = Field(description="文件路径")
    replaces: list[ReplaceItem] = Field(description="要替换的段落列表，每个元素包含id和new_content")


@tool(args_schema=ReplaceLineInput)
async def replace_line(path: str, replaces: list[dict]) -> str:
    """
替换指定段落的内容
使用示例：
当你看到文件内容格式为：
3-b2|这是第三段的内容
4-ff|这是第四段的内容
5-a1|这是第五段的内容
{
  "path": "第一章.md",
  "replaces": [
    {"id": "3-b2", "new_content": "这是段落3的新内容"},
    {"id": "5-a1", "new_content": "这是段落5的新内容"}
  ]
}
    """
    try:
        original_content = await file_service_read_file(path)
        paragraphs, paragraph_ending = split_paragraphs(original_content)

        replaced_count = 0
        errors = []

        for item in replaces:
            item_id = item.id if hasattr(item, 'id') else item.get('id', '')
            new_content = item.new_content if hasattr(item, 'new_content') else item.get('new_content', '')

            # 解析ID
            paragraph, hash = parse_id(item_id)
            index = paragraph - 1

            # 检查段落号是否有效
            if index < 0 or index >= len(paragraphs):
                errors.append(f"段落{paragraph}超出范围（共{len(paragraphs)}段）")
                continue

            actual = paragraphs[index]
            actual_hash = get_short_hash(actual)

            # 验证哈希值
            if actual_hash != hash.lower():
                errors.append(f"段落{paragraph}哈希不匹配，期望：{hash}，实际：{actual_hash}")
                continue

            # 替换段落
            paragraphs[index] = new_content
            replaced_count += 1

        await file_service_update_file(path, paragraph_ending.join(paragraphs))

        if errors:
            return f"【工具结果】：成功替换{replaced_count}个段落，但有错误：{'; '.join(errors)}"

        return f"【工具结果】：成功替换{replaced_count}个段落"

    except Exception as e:
        return f"【工具结果】：操作失败: {str(e)}"
