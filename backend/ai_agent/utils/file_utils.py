"""
文件工具函数
提供统一的文件处理功能
"""


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
