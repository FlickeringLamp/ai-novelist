from pydantic import BaseModel, Field
from langchain.tools import tool
from backend.file.file_service import read_file as file_service_read_file
from backend.file.file_service import update_file as file_service_update_file
from backend.ai_agent.utils.file_utils import split_paragraphs, get_short_hash, parse_id


class DeleteItem(BaseModel):
    id: str = Field(description="要删除的段落ID（格式：段落号-哈希，如 '3-b2'）")


class DeleteLineInput(BaseModel):
    path: str = Field(description="文件路径")
    deletes: list[DeleteItem] = Field(description="要删除的段落列表，每个元素包含id")


@tool(args_schema=DeleteLineInput)
async def delete_line(path: str, deletes: list[dict]) -> str:
    """
删除指定段落
使用示例：
当你看到文件内容格式为：
3-b2|这是第三段的内容
4-ff|这是第四段的内容
5-a1|这是第五段的内容
{
  "path": "第一章.md",
  "deletes": [
    {"id": "3-b2"},
    {"id": "5-a1"}
  ]
}
==注意！空行的哈希始终为e3，如"2-e3|"，"4-e3|"==
    """
    try:
        original_content = await file_service_read_file(path)
        paragraphs, paragraph_ending = split_paragraphs(original_content)

        # 解析所有删除项，提取段落号和哈希
        parsed_deletes = []
        for item in deletes:
            item_id = item.id if hasattr(item, 'id') else item.get('id', '')
            paragraph, hash_value = parse_id(item_id)
            parsed_deletes.append({
                'paragraph': paragraph,
                'hash': hash_value,
                'id': item_id
            })

        # 按段落号降序排序，从后往前删除，避免行号偏移
        sorted_deletes = sorted(parsed_deletes, key=lambda x: x['paragraph'], reverse=True)

        deleted_count = 0
        errors = []

        for item in sorted_deletes:
            paragraph = item['paragraph']
            hash = item['hash']
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

            # 删除段落
            del paragraphs[index]
            deleted_count += 1

        await file_service_update_file(path, paragraph_ending.join(paragraphs))

        if errors:
            return f"【工具结果】：成功删除{deleted_count}个段落，但有错误：{'; '.join(errors)}"

        return f"【工具结果】：成功删除{deleted_count}个段落"

    except Exception as e:
        return f"【工具结果】：操作失败: {str(e)}"
