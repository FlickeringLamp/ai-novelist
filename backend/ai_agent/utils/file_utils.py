"""
文件工具函数
提供统一的文件处理功能
"""

import hashlib


def split_paragraphs(content: str) -> tuple[list[str], str]:
    """
    按段落分割文本，并检测换行符类型

    Args:
        content: 文件内容

    Returns:
        tuple: (段落列表, 换行符)
            - 段落列表: 使用splitlines()分割的段落
            - 换行符: 检测到的换行符（"\r\n" 或 "\n"）
    """
    # 检测换行符类型
    paragraph_ending = "\r\n" if "\r\n" in content else "\n"

    # 使用splitlines()分割段落（能正确处理多种换行符格式）
    paragraphs = content.splitlines()

    return paragraphs, paragraph_ending


def get_short_hash(content: str, length: int = 2) -> str:
    # 移除首尾空白并计算哈希
    normalized = content.strip()
    hash_value = hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    return hash_value[:length]


def make_id(paragraph: int, content: str, hash_length: int = 2) -> str:
    """
    生成段落ID，格式为：段落号-哈希

    Args:
        paragraph: 段落号（从1开始）
        content: 段落内容
        hash_length: 哈希长度，默认为2

    Returns:
        ID字符串，例如："3-b2"
    """
    short_hash = get_short_hash(content, hash_length)
    return f"{paragraph}-{short_hash}"


def parse_id(item_id: str) -> tuple[int, str]:
    """
    解析段落ID，提取段落号和哈希值

    Args:
        item_id: ID字符串，例如："3-b2"

    Returns:
        tuple: (段落号, 哈希值)

    Raises:
        ValueError: 如果ID格式无效
    """
    try:
        parts = item_id.split('-')
        if len(parts) != 2:
            raise ValueError(f"无效的ID格式: {item_id}，期望格式为 '段落号-哈希'（如 '3-b2'）")

        paragraph = int(parts[0])
        hash_value = parts[1].lower()

        return paragraph, hash_value
    except ValueError as e:
        if "无效的ID格式" in str(e):
            raise
        raise ValueError(f"无效的ID格式: {item_id}，段落号必须是数字")


def format_file_with_hashes(content: str) -> str:
    """将文件内容格式化为 "段落号-短哈希|内容" 的形式"""
    if not content or not content.strip():
        return "(空文件)"

    paragraphs, _ = split_paragraphs(content)
    lines = []

    for i, para in enumerate(paragraphs, start=1):
        item_id = make_id(i, para)
        lines.append(f"{item_id}|{para}")

    return "\n".join(lines)
