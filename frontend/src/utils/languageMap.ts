/**
 * 文件扩展名到 Monaco 编辑器语言类型的映射表
 */
export const languageMap: Record<string, string> = {
  // 标记语言
  'md': 'markdown',
  'json': 'json',
  // 脚本语言
  'js': 'javascript',
  'py': 'python',
  'sh': 'shell',
  'ps1': 'powershell',
  // 其他
  'txt': 'plaintext',
};
