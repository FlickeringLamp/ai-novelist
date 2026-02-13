import { useDispatch, useSelector, useStore } from 'react-redux';
import { addTempFile } from '../store/file';
import { createTempDiffTab, updateBackUp } from '../store/editor';
import type { RootState } from '../store/store';
import httpClient from './httpClient';

// 支持的文件工具列表
export const FILE_TOOLS = ['write_file', 'insert_content', 'apply_diff', 'search_and_replace'];

// 验证文件名是否以.md结尾
const isValidMdFile = (path: string): boolean => {
  return path.endsWith('.md');
};

// 解析replacements内容，计算修改后的内容
const applyDiff = (originalContent: string, replacements: any[]): string => {
  const lines = originalContent.split('\n');
  const result = [...lines];
  
  // 按行号排序，删除操作需要从后往前处理以避免行号偏移
  const sortedReplacements = [...replacements].sort((a, b) => b.line - a.line);
  
  for (const replacement of sortedReplacements) {
    const lineNum = replacement.line;
    const oldContent = replacement.old;
    const newContent = replacement.new;
    
    // 转换为0-based索引
    const index = lineNum - 1;
    
    // 检查行号是否有效
    if (index < 0 || index >= result.length) {
      console.warn(`行号 ${lineNum} 超出文件范围（文件共 ${result.length} 行）`);
      continue;
    }
    
    // 获取文件中的实际内容
    const actualContent = result[index];
    
    // 验证内容是否匹配
    if (actualContent !== oldContent) {
      console.warn(`行 ${lineNum} 的内容不匹配\n期望: ${oldContent}\n实际: ${actualContent}`);
      continue;
    }
    
    // 执行替换或删除
    if (newContent === null) {
      // 删除该行
      result.splice(index, 1);
    } else {
      // 替换该行
      result[index] = newContent;
    }
  }
  
  return result.join('\n');
};

// 搜索并替换文本
const searchAndReplace = (content: string, search: string, replace: string, useRegex: boolean = false, ignoreCase: boolean = false): string => {
  if (useRegex) {
    const flags = ignoreCase ? 'gi' : 'g';
    const regex = new RegExp(search, flags);
    return content.replace(regex, replace);
  } else {
    if (ignoreCase) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return content.replace(regex, replace);
    } else {
      return content.split(search).join(replace);
    }
  }
};

// 在指定位置插入内容
const insertContent = (content: string, paragraph: number, newContent: string): string => {
  const lines = content.split('\n');
  
  if (paragraph === 0) {
    // 在文件末尾追加
    lines.push(newContent);
  } else {
    // 在指定段落插入
    const insertIndex = Math.min(paragraph - 1, lines.length);
    lines.splice(insertIndex, 0, newContent);
  }
  
  return lines.join('\n');
};

// 自定义 Hook：处理文件工具调用
export const useFileToolHandler = () => {
  const dispatch = useDispatch();
  const store = useStore();

  // 获取文件内容（优先使用前端状态中的缓存）
  const fetchFileContent = async (path: string): Promise<string> => {
    try {
      // 优先使用 backUp，currentData可能有丢弃脏数据，不应该使用
      // 使用 store.getState() 获取最新状态，避免闭包问题
      const editorState = (store.getState() as RootState).tabSlice;
      const cachedContent = editorState.backUp[path];
      
      if (cachedContent !== undefined) {
        return cachedContent;
      }
      
      // 前端状态中没有，从后端获取
      const result = await httpClient.get(`/api/file/read/${encodeURIComponent(path)}`);
      const content = result?.content || '';
      
      // 将获取的内容存储到 backUp 中作为缓存
      dispatch(updateBackUp({ id: path, content }));
      console.log("存了吗？",{id: path, content})
      
      return content;
    } catch (error) {
      console.error(`读取文件 ${path} 失败:`, error);
      // 将空字符串存储到 backUp 缓存中，避免重复请求
      dispatch(updateBackUp({ id: path, content: '' }));
      return '';
    }
  };

  // 处理文件工具调用
  const handleFileToolCall = async (toolName: string, args: any) => {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    const path = parsedArgs.path;
    
    if (!path || !isValidMdFile(path)) {
      return;
    }

    // 添加临时文件到文件树
    dispatch(addTempFile({ path }));

    // 获取原文件内容（所有工具都需要获取原内容）
    const originalContent = await fetchFileContent(path);
    let modifiedContent = originalContent;

    // 根据工具类型计算修改后的内容
    switch (toolName) {
      case 'write_file': {
        const content = parsedArgs.content;
        if (content !== undefined) {
          modifiedContent = content;
        }
        break;
      }
      
      case 'insert_content': {
        const paragraph = parsedArgs.paragraph;
        const content = parsedArgs.content;
        
        if (paragraph !== undefined && content !== undefined) {
          modifiedContent = insertContent(originalContent, paragraph, content);
        }
        break;
      }
      
      case 'apply_diff': {
        const replacements = parsedArgs.replacements;
        
        if (replacements && Array.isArray(replacements)) {
          modifiedContent = applyDiff(originalContent, replacements);
        }
        break;
      }
      
      case 'search_and_replace': {
        const search = parsedArgs.search;
        const replace = parsedArgs.replace;
        const useRegex = parsedArgs.use_regex || false;
        const ignoreCase = parsedArgs.ignore_case || false;
        
        if (search !== undefined && replace !== undefined) {
          modifiedContent = searchAndReplace(originalContent, search, replace, useRegex, ignoreCase);
        }
        break;
      }
    }

    // 创建差异对比标签页（backUp为原内容，currentData为修改后的内容）
    dispatch(createTempDiffTab({ id: path, originalContent, modifiedContent }));
  };

  // 处理AI消息中的文件工具调用
  const processFileToolCalls = async (toolCalls: any[]) => {
    for (const toolCall of toolCalls) {
      const toolName = toolCall.name;
      
      // 只处理支持的文件工具
      if (FILE_TOOLS.includes(toolName || '')) {
        const args = toolCall.args;
        
        if ((args as any)._loading && (args as any)._partial_args) {
          // 处理加载中的_partial_args
          try {
            const partialArgs = JSON.parse((args as any)._partial_args);
            await handleFileToolCall(toolName || '', partialArgs);
          } catch (e) {
            console.error("解析_partial_args失败:", e);
          }
        } else {
          // 处理完整的args
          await handleFileToolCall(toolName || '', args);
        }
      }
    }
  };

  return { processFileToolCalls };
};
