import { useDispatch, useSelector, useStore } from 'react-redux';
import { addTempFile } from '../store/file';
import { createTempDiffTab, updateBackUp, setAiSuggestContent } from '../store/editor';
import type { RootState } from '../types';
import httpClient from './httpClient';
import { languageMap } from './languageMap';

// 支持的文件工具列表
export const FILE_TOOLS = ['manage_file', 'apply_diff', 'search_text'];

// 验证文件扩展名是否受支持
const isValidFile = (path: string): boolean => {
  const lastDotIndex = path.lastIndexOf('.');
  if (lastDotIndex <= 0) return false;
  const ext = path.slice(lastDotIndex + 1).toLowerCase();
  return ext in languageMap;
};

// 解析operations内容，计算修改后的内容（支持插入、替换、删除）
const applyDiff = (originalContent: string, operations: any[]): string => {
  const paragraphs = originalContent.split('\n');
  const result = [...paragraphs];
  
  // 按段落号降序排序，避免索引偏移
  const sortedOps = [...operations].sort((a, b) => b.paragraph - a.paragraph);
  
  for (const op of sortedOps) {
    const paragraphNum = op.paragraph;
    const oldContent = op.old;
    const newContent = op.new;
    const index = paragraphNum - 1;
    
    // 插入操作：old为null/undefined
    if (oldContent === null || oldContent === undefined) {
      if (newContent === null || newContent === undefined) {
        console.warn(`操作无效：old和new不能同时为null（段落${paragraphNum}）`);
        continue;
      }
      // 1=开头，大于长度=末尾，其他=指定位置前
      const insertPos = paragraphNum <= 1 ? 0 : Math.min(index, result.length);
      result.splice(insertPos, 0, newContent);
      continue;
    }
    
    // 替换/删除操作：需要验证old内容
    if (index < 0 || index >= result.length) {
      console.warn(`段落${paragraphNum}超出范围（共${result.length}段）`);
      continue;
    }
    
    const actualContent = result[index];
    if (actualContent !== oldContent) {
      console.warn(`段${paragraphNum}内容不匹配\n期望: ${oldContent}\n实际: ${actualContent}`);
      continue;
    }
    
    if (newContent === null || newContent === undefined) {
      result.splice(index, 1); // 删除
    } else {
      result[index] = newContent; // 替换
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
    
    if (!path || !isValidFile(path)) {
      return;
    }

    // 添加临时文件到文件树
    dispatch(addTempFile({ path }));

    // 获取原文件内容（所有工具都需要获取原内容）
    const originalContent = await fetchFileContent(path);
    let modifiedContent = originalContent;

    // 根据工具类型计算修改后的内容
    switch (toolName) {
      case 'manage_file': {
        const content = parsedArgs.content;
        // content为null时表示删除文件
        if (content === null) {
          modifiedContent = '该文件将被删除';
        } else if (content !== undefined) {
          modifiedContent = content;
        }
        break;
      }
      
      case 'apply_diff': {
        const operations = parsedArgs.operations;
        
        if (operations && Array.isArray(operations)) {
          modifiedContent = applyDiff(originalContent, operations);
        }
        break;
      }
      
      case 'search_text': {
        const pattern = parsedArgs.pattern;
        const replace = parsedArgs.replace;
        
        // 只有在有替换参数时才在前端预览
        if (pattern !== undefined && replace !== undefined) {
          modifiedContent = searchAndReplace(originalContent, pattern, replace, true, false);
        }
        break;
      }
    }

    // 创建差异对比标签页（backUp为原内容，currentData为修改后的内容）
    dispatch(createTempDiffTab({ id: path, originalContent, modifiedContent }));
    
    // 设置AI建议内容为修改后的内容快照（用于后续计算用户diff）
    dispatch(setAiSuggestContent({ id: path, content: modifiedContent }));
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
