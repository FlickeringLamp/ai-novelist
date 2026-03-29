/**
 * Diff 计算工具函数
 * 用于计算用户修改与AI建议之间的差异
 */

import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

/**
 * 计算两个文本之间的差异，返回标准patch格式
 * @param oldText 原始文本（AI建议内容）
 * @param newText 新文本（用户编辑后的内容）
 * @returns patch格式的差异字符串
 */
export const computeDiff = (oldText: string, newText: string): string => {
  const diff = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diff);
  const patches = dmp.patch_make(oldText, diff);
  const patchText = dmp.patch_toText(patches);
  // diff-match-patch 会对非ASCII字符进行编码，需要解码
  return decodeURIComponent(patchText);
};

/**
 * 检查两个文本是否有差异
 * @param oldText 原始文本
 * @param newText 新文本
 * @returns 是否有差异
 */
export const hasDiff = (oldText: string, newText: string): boolean => {
  return oldText !== newText;
};
