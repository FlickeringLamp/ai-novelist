旧的apply_diff工具，未来可能还有用
如今改用这个格式，对ai的理解成本更低，代码复杂度也进一步降低。
可能需要添加一个delete工具，补全新apply_diff工具缺失的功能

```json
{
  "path": "文件路径",
  "replacements": [
    {
      "line": 10,
      "old": "原始内容",
      "new": "新内容"
    }
  ]
}

```

```python
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
from langchain.tools import tool
from langgraph.types import interrupt
from backend.config.config import settings
from rapidfuzz import distance as rapidfuzz_distance

class ApplyDiffInput(BaseModel):
    """应用差异的输入参数"""
    path: str = Field(description="文件路径（相对于novel目录的相对路径）")
    diff: str = Field(description="差异内容")

# ==================== Diff应用相关辅助函数 ====================

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

def add_line_numbers(content: str, start_line: int = 1) -> str:
    """为内容添加行号"""
    if content == "":
        return "" if start_line == 1 else f"{start_line} | \n"
    
    lines = content.split("\n")
    # 移除最后的空行
    if lines and lines[-1] == "":
        lines.pop()
    
    max_line_number_width = len(str(start_line + len(lines) - 1))
    numbered_lines = []
    
    for i, line in enumerate(lines):
        line_number = str(start_line + i).rjust(max_line_number_width, ' ')
        numbered_lines.append(f"{line_number} | {line}")
    
    return "\n".join(numbered_lines) + "\n"

def every_line_has_line_numbers(content: str) -> bool:
    """检查每行是否都有行号前缀"""
    lines = content.splitlines()
    # 处理最后的空行
    if lines and lines[-1].strip() == '':
        lines.pop()
    
    if not lines:
        return False
    
    # 检查每行是否以"数字 | "格式开头
    pattern = re.compile(r'^\s*\d+\s+\|(?!\|)')
    return all(pattern.match(line) for line in lines)

def strip_line_numbers(content: str, aggressive: bool = False) -> str:
    """移除内容中的行号"""
    lines = content.splitlines()
    processed_lines = []
    
    for line in lines:
        if aggressive:
            # 宽松模式：匹配 "数字 | 内容" 或 "| 内容"
            match = re.match(r'^\s*(?:\d+\s)?\|\s?(.*)$', line)
        else:
            # 严格模式：只匹配 "数字 | 内容"
            match = re.match(r'^\s*\d+\s+\|(?!\|)\s?(.*)$', line)
        
        if match:
            processed_lines.append(match.group(1))
        else:
            processed_lines.append(line)
    
    line_ending = "\r\n" if content.find("\r\n") != -1 else "\n"
    return line_ending.join(processed_lines)

def unescape_markers(content: str) -> str:
    """取消转义的标记字符"""
    return (
        content.replace("\\<<<<<<<", "<<<<<<<")
        .replace("\\=======", "=======")
        .replace("\\>>>>>>>", ">>>>>>>")
        .replace("\\-------", "-------")
        .replace("\\:start_line:", ":start_line:")
    )

def validate_marker_sequencing(diff_content: str) -> dict:
    """验证diff标记的序列是否正确"""
    class State:
        START = 0
        AFTER_SEARCH = 1
        AFTER_SEPARATOR = 2
    
    state = State.START
    lines = diff_content.split('\n')
    
    for line_num, line in enumerate(lines, 1):
        marker = line.strip()
        
        if state == State.START:
            if marker == '=======':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的======="}
            if marker == '>>>>>>> REPLACE':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的>>>>>>> REPLACE"}
            if marker == '<<<<<<< SEARCH':
                state = State.AFTER_SEARCH
                
        elif state == State.AFTER_SEARCH:
            if marker == '<<<<<<< SEARCH':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的<<<<<<< SEARCH"}
            if marker == '>>>>>>> REPLACE':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的>>>>>>> REPLACE"}
            if marker == '=======':
                state = State.AFTER_SEPARATOR
                
        elif state == State.AFTER_SEPARATOR:
            if marker == '<<<<<<< SEARCH':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的<<<<<<< SEARCH"}
            if marker == '=======':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的======="}
            if marker == '>>>>>>> REPLACE':
                state = State.START
    
    if state != State.START:
        expected = "=======" if state == State.AFTER_SEARCH else ">>>>>>> REPLACE"
        return {"success": False, "error": f"无效的diff格式：意外的内容结尾。期望{expected}"}
    
    return {"success": True}

def fuzzy_search(lines: List[str], search_chunk: str, start_index: int, end_index: int) -> dict:
    """模糊搜索匹配的内容"""
    best_score = 0.0
    best_match_index = -1
    best_match_content = ""
    search_lines = search_chunk.splitlines()
    search_len = len(search_lines)
    
    mid_point = (start_index + end_index) // 2
    left_index = mid_point
    right_index = mid_point + 1
    
    while left_index >= start_index or right_index <= end_index - search_len:
        if left_index >= start_index:
            original_chunk = "\n".join(lines[left_index:left_index + search_len])
            similarity = get_similarity(original_chunk, search_chunk)
            if similarity > best_score:
                best_score = similarity
                best_match_index = left_index
                best_match_content = original_chunk
            left_index -= 1
        
        if right_index <= end_index - search_len:
            original_chunk = "\n".join(lines[right_index:right_index + search_len])
            similarity = get_similarity(original_chunk, search_chunk)
            if similarity > best_score:
                best_score = similarity
                best_match_index = right_index
                best_match_content = original_chunk
            right_index += 1
    
    return {
        "best_score": best_score,
        "best_match_index": best_match_index,
        "best_match_content": best_match_content
    }


@tool(args_schema=ApplyDiffInput)
def apply_diff(path: str, diff: str) -> str:
    """应用差异修改
    用于替换已有文本
    
    使用标准的SEARCH/REPLACE块格式来修改文件内容。
    
    格式示例：
    <<<<<<< SEARCH
    :start_line:1
    -------
    原始内容第一行
    原始内容第二行
    =======
    修改后内容第一行
    修改后内容第二行
    >>>>>>> REPLACE
    
    重要说明：
    1. 必须使用 <<<<<<< SEARCH 和 >>>>>>> REPLACE 标记
    2. 使用 :start_line:行号 指定搜索起始行（可选，但推荐）
    3. 使用 ------- 分隔元数据和搜索内容（可选）
    4. 使用 ======= 分隔搜索内容和替换内容
    5. 不支持git diff格式或其他diff格式
    
    Args:
        path: 文件路径（相对于novel目录的相对路径）
        diff: 差异内容，必须使用SEARCH/REPLACE块格式
    """
    # 构造包含工具具体信息的中断数据
    interrupt_data = {
        "tool_name": "apply_diff",
        "tool_display_name": "应用差异",
        "description": f"应用差异: {path}",
        "parameters": {
            "path": path,
            "diff": diff
        }
    }
    user_choice = interrupt(interrupt_data)
    print(f"用户选择{user_choice}")
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            # 将相对路径拼接NOVEL_DIR
            file_path = Path(settings.NOVEL_DIR) / path
            
            # 读取原始文件内容
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
    
            # 验证diff格式
            valid_seq = validate_marker_sequencing(diff)
            if not valid_seq["success"]:
                return f"【工具结果】：应用差异失败: {valid_seq['error']} ;**【用户信息】：{choice_data}**"
    
            # 解析diff块
            # 支持的格式：
            # 1. <<<<<<< SEARCH 或 <<<<<<< SEARCH>（允许末尾的 >）
            # 2. :start_line: 标记（可选）
            # 3. ------- 分隔符（可选）
            # 4. ======= 分隔符
            # 5. >>>>>>> REPLACE 标记
            diff_block_pattern = r'(?:^|\n)(?<!\\)<<<<<<< SEARCH>?\s*\n((?:\:start_line:\s*(\d+)\s*\n))?((?<!\\)-------\s*\n)?([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)=======\s*\n)([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)>>>>>>> REPLACE)(?=\n|$)'
            matches = list(re.finditer(diff_block_pattern, diff))
    
            if not matches:
                return f"【工具结果】：应用差异失败: 无效的diff格式 - 未找到有效的SEARCH/REPLACE块 ;**【用户信息】：{choice_data}**"
    
            # 确定行结束符
            line_ending = "\r\n" if "\r\n" in original_content else "\n"
            result_lines = original_content.splitlines()
            delta = 0
            applied_count = 0
            fail_parts = []
    
            # 解析所有替换操作并按起始行排序
            replacements = []
            for match in matches:
                # 正则表达式捕获组：
                # group(1): :start_line: 行（包含标记本身）
                # group(2): :start_line: 的数字
                # group(3): ------- 行（包含分隔符本身）
                # group(4): 搜索内容
                # group(5): 替换内容
                
                start_line = 0
                if match.group(2):  # :start_line: 标记存在
                    start_line = int(match.group(2))
                
                search_content = match.group(4) or ""
                replace_content = match.group(5) or ""
        
                replacements.append({
                    "start_line": start_line,
                    "search_content": search_content,
                    "replace_content": replace_content
                })
    
            # 按起始行排序
            replacements.sort(key=lambda x: x["start_line"])
    
            # 应用每个替换
            for replacement in replacements:
                search_content = replacement["search_content"]
                replace_content = replacement["replace_content"]
                start_line = replacement["start_line"] + (0 if replacement["start_line"] == 0 else delta)
        
                # 取消转义标记
                search_content = unescape_markers(search_content)
                replace_content = unescape_markers(replace_content)
                
                # 处理行号
                has_all_line_numbers = (every_line_has_line_numbers(search_content) and
                                      every_line_has_line_numbers(replace_content)) or \
                                     (every_line_has_line_numbers(search_content) and
                                      replace_content.strip() == "")
        
                if has_all_line_numbers and start_line == 0:
                    # 从搜索内容的第一行提取起始行号
                    first_line = search_content.split("\n")[0]
                    line_num_match = re.match(r'^\s*(\d+)\s+\|', first_line)
                    if line_num_match:
                        start_line = int(line_num_match.group(1))
        
                if has_all_line_numbers:
                    search_content = strip_line_numbers(search_content)
                    replace_content = strip_line_numbers(replace_content)
        
                # 跳过空搜索或相同内容
                if not search_content.strip() or search_content == replace_content:
                    fail_parts.append({"success": False, "error": "搜索内容为空或与替换内容相同"})
                    continue
        
                search_lines = search_content.splitlines()
                replace_lines = replace_content.splitlines()
                search_chunk = "\n".join(search_lines)
        
                # 查找匹配位置
                match_index = -1
                best_match_score = 0.0
                search_start_index = 0
                search_end_index = len(result_lines)
        
                fuzzy_threshold = 0.9
                buffer_lines = 40
        
                if start_line > 0:
                    exact_start_index = start_line - 1
                    if exact_start_index < len(result_lines):
                        original_chunk = "\n".join(result_lines[exact_start_index:exact_start_index + len(search_lines)])
                        similarity = get_similarity(original_chunk, search_chunk)
                        if similarity >= fuzzy_threshold:
                            match_index = exact_start_index
                            best_match_score = similarity
                        else:
                            search_start_index = max(0, start_line - (buffer_lines + 1))
                            search_end_index = min(len(result_lines), start_line + len(search_lines) + buffer_lines)
        
                # 如果精确匹配失败，进行模糊搜索
                if match_index == -1:
                    search_result = fuzzy_search(result_lines, search_chunk, search_start_index, search_end_index)
                    match_index = search_result["best_match_index"]
                    best_match_score = search_result["best_score"]
        
                # 如果仍然没有找到匹配，尝试宽松的行号移除
                if match_index == -1 or best_match_score < fuzzy_threshold:
                    aggressive_search_content = strip_line_numbers(search_content, aggressive=True)
                    if aggressive_search_content != search_content:
                        aggressive_search_chunk = "\n".join(aggressive_search_content.splitlines())
                        search_result = fuzzy_search(result_lines, aggressive_search_chunk, search_start_index, search_end_index)
                        if search_result["best_match_index"] != -1 and search_result["best_score"] >= fuzzy_threshold:
                            match_index = search_result["best_match_index"]
                            best_match_score = search_result["best_score"]
                            search_content = aggressive_search_content
                            replace_content = strip_line_numbers(replace_content, aggressive=True)
                            search_lines = search_content.splitlines()
                            replace_lines = replace_content.splitlines()
        
                # 检查匹配结果
                if match_index == -1 or best_match_score < fuzzy_threshold:
                    error_msg = f"【工具结果】：未找到足够相似的匹配 (相似度: {best_match_score:.2f}, 需要: {fuzzy_threshold}) ;**【用户信息】：{choice_data}**"
                    # 显示附近的内容
                    start = max(0, start_line - 5)
                    end = min(len(result_lines), start_line + 5)
                    original_section = add_line_numbers("\n".join(result_lines[start:end]), start + 1)
                    fail_parts.append({
                        "success": False,
                        "error": f"{error_msg}\n第{start_line}行附近的内容:\n{original_section}"
                    })
                    continue
        
                # 应用替换，保持缩进
                matched_lines = result_lines[match_index:match_index + len(search_lines)]
                original_indents = []
                for line in matched_lines:
                    if line:
                        match = re.match(r'^[\t ]*', line)
                        original_indents.append(match.group() if match else "")
                    else:
                        original_indents.append("")
                search_indents = []
                for line in search_lines:
                    if line:
                        match = re.match(r'^[\t ]*', line)
                        search_indents.append(match.group() if match else "")
                    else:
                        search_indents.append("")
        
                indented_replace_lines = []
                for i, line in enumerate(replace_lines):
                    if i < len(original_indents):
                        matched_indent = original_indents[0] if original_indents else ""
                        if line:
                            match_result = re.match(r'^[\t ]*', line)
                            current_indent = match_result.group() if match_result else ""
                        else:
                            current_indent = ""
                        search_base_indent = search_indents[0] if search_indents else ""
                
                        search_base_level = len(search_base_indent)
                        current_level = len(current_indent)
                        relative_level = current_level - search_base_level
                
                        if relative_level < 0:
                            final_indent = matched_indent[:max(0, len(matched_indent) + relative_level)]
                        else:
                            final_indent = matched_indent + current_indent[search_base_level:]
                
                        indented_replace_lines.append(final_indent + line.lstrip())
                    else:
                        indented_replace_lines.append(line)
        
                # 执行替换
                result_lines[match_index:match_index + len(search_lines)] = indented_replace_lines
                delta += len(replace_lines) - len(search_lines)
                applied_count += 1
    
            # 检查应用结果
            if applied_count == 0:
                error_details = "\n".join([part["error"] for part in fail_parts])
                return f"【工具结果】：应用差异失败: 未应用任何更改。所有diff部分都失败了。\n失败详情:\n{error_details} ;**【用户信息】：{choice_data}**"
    
            # 写入修改后的内容
            new_content = line_ending.join(result_lines)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
    
            success_msg = f"【工具结果】：差异已成功应用到文件 '{path}'，应用了 {applied_count} 个更改 ;**【用户信息】：{choice_data}**"
            if fail_parts:
                error_details = "\n".join([part["error"] for part in fail_parts])
                success_msg += f"【工具结果】： {len(fail_parts)} 个更改失败:\n{error_details} ;**【用户信息】：{choice_data}**"

            return success_msg
        except Exception as e:
            return f"【工具结果】：应用差异失败: {str(e)} ;**【用户信息】：{choice_data}**"
    else:
        return f"【工具结果】：用户取消了工具 ;**【用户信息】：{choice_data}**"


```