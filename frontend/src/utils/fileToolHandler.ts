import { useDispatch, useStore } from 'react-redux';
import { useRef } from 'react';
import { addTempFile } from '../store/file';
import { createTempDiffTab, updateBackUp, setAiSuggestContent } from '../store/editor';
import type { RootState } from '../types';
import type { InsertLineItem, DeleteLineItem, ReplaceLineItem } from '../types';
import httpClient from './httpClient';
import { createPathStabilizer } from './paramStabilizer';
import CryptoJS from 'crypto-js';

// 支持的文件工具列表
export const FILE_TOOLS = ['manage_file', 'insert_line', 'delete_line', 'replace_line', 'search_text'];

// 计算短哈希值（与后端一致，使用SHA256，默认2位）
const getShortHash = (content: string, length: number = 2): string => {
  const normalized = content.trim();
  const hash = CryptoJS.SHA256(normalized).toString(CryptoJS.enc.Hex);
  return hash.substring(0, length);
};

// 段落分割函数（处理 \r\n 和 \n）
const splitParagraphs = (content: string): string[] => {
  return content.split(/\r?\n/);
};

// 解析ID字符串，提取段落号和哈希值
// ID格式：段落号-哈希（如 "3-b2"）
const parseId = (id: string): { paragraph: number; hash: string } => {
  const parts = id.split('-');
  if (parts.length !== 2) {
    throw new Error(`无效的ID格式: ${id}，期望格式为 '段落号-哈希'（如 '3-b2'）`);
  }
  const paragraphStr = parts[0]!;
  const hashStr = parts[1]!;
  const paragraph = parseInt(paragraphStr, 10);
  if (isNaN(paragraph)) {
    throw new Error(`无效的ID格式: ${id}，段落号必须是数字`);
  }
  return { paragraph, hash: hashStr.toLowerCase() };
};

// 批量插入行（按段落号降序排序，从后往前插入，避免行号偏移）
const insertLines = (originalContent: string, inserts: InsertLineItem[]): string => {
  const paragraphs = splitParagraphs(originalContent);
  
  // 按段落号降序排序，从后往前插入
  const sortedInserts = [...inserts].sort((a, b) => b.paragraph - a.paragraph);
  
  for (const item of sortedInserts) {
    const index = item.paragraph - 1;
    const insertPos = item.paragraph <= 1 ? 0 : Math.min(index, paragraphs.length);
    paragraphs.splice(insertPos, 0, item.content);
  }
  
  return paragraphs.join('\n');
};

// 批量删除行（按段落号降序排序，从后往前删除，避免行号偏移）
const deleteLines = (originalContent: string, deletes: DeleteLineItem[]): string => {
  const paragraphs = splitParagraphs(originalContent);

  // 解析所有删除项，提取段落号和哈希
  const parsedDeletes = deletes.map(item => {
    const parsed = parseId(item.id);
    return { ...parsed, id: item.id };
  });

  // 按段落号降序排序，从后往前删除
  const sortedDeletes = parsedDeletes.sort((a, b) => b.paragraph - a.paragraph);

  for (const item of sortedDeletes) {
    const index = item.paragraph - 1;

    if (index < 0 || index >= paragraphs.length) {
      console.warn(`段落${item.paragraph}超出范围（共${paragraphs.length}段）`);
      continue;
    }

    const actualContent = paragraphs[index] || '';
    const actualHash = getShortHash(actualContent);

    if (actualHash !== item.hash) {
      console.warn(`ID ${item.id} 哈希不匹配\n期望: ${item.hash}\n实际: ${actualHash}`);
      continue;
    }

    paragraphs.splice(index, 1);
  }

  return paragraphs.join('\n');
};

// 批量替换行（替换不影响行号偏移，顺序无关）
const replaceLines = (originalContent: string, replaces: ReplaceLineItem[]): string => {
  const paragraphs = splitParagraphs(originalContent);

  for (const item of replaces) {
    const parsed = parseId(item.id);
    const index = parsed.paragraph - 1;

    if (index < 0 || index >= paragraphs.length) {
      console.warn(`段落${parsed.paragraph}超出范围（共${paragraphs.length}段）`);
      continue;
    }

    const actualContent = paragraphs[index] || '';
    const actualHash = getShortHash(actualContent);

    if (actualHash !== parsed.hash) {
      console.warn(`ID ${item.id} 哈希不匹配\n期望: ${parsed.hash}\n实际: ${actualHash}`);
      continue;
    }

    paragraphs[index] = item.new_content;
  }

  return paragraphs.join('\n');
};

// 搜索并替换文本
const searchAndReplace = (content: string, pattern: string, replace: string, useRegex: boolean = false, ignoreCase: boolean = false): string => {
  if (useRegex) {
    const flags = ignoreCase ? 'gi' : 'g';
    const regex = new RegExp(pattern, flags);
    return content.replace(regex, replace);
  } else {
    if (ignoreCase) {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return content.replace(regex, replace);
    } else {
      return content.split(pattern).join(replace);
    }
  }
};


// 自定义 Hook：处理文件工具调用
export const useFileToolHandler = () => {
  const dispatch = useDispatch();
  const store = useStore();
  // 路径稳定检测器 - 每个工具调用使用独立实例
  const pathStabilizerRef = useRef<ReturnType<typeof createPathStabilizer> | null>(null);

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
  const handleFileToolCall = async (toolName: string, args: any, isPartial: boolean = false) => {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    const path: string | undefined = parsedArgs.path;
    
    // === 路径稳定检测（针对流式传输中的不完整路径）===
    if (isPartial) {
      // 初始化稳定检测器
      if (!pathStabilizerRef.current) {
        pathStabilizerRef.current = createPathStabilizer();
      }
      
      // 路径未稳定，直接返回，不处理
      if (!pathStabilizerRef.current(path)) {
        return;
      }
      
      // 路径已稳定，继续处理
    } else {
      // 完整参数，重置检测器
      pathStabilizerRef.current = null;
    }
    
    // 路径为空则不处理
    if (!path) {
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
      
      case 'insert_line': {
        const inserts: InsertLineItem[] = parsedArgs.inserts;
        
        if (inserts && Array.isArray(inserts) && inserts.length > 0) {
          modifiedContent = insertLines(originalContent, inserts);
        }
        break;
      }
      
      case 'delete_line': {
        const deletes: DeleteLineItem[] = parsedArgs.deletes;
        
        if (deletes && Array.isArray(deletes) && deletes.length > 0) {
          modifiedContent = deleteLines(originalContent, deletes);
        }
        break;
      }
      
      case 'replace_line': {
        const replaces: ReplaceLineItem[] = parsedArgs.replaces;
        
        if (replaces && Array.isArray(replaces) && replaces.length > 0) {
          modifiedContent = replaceLines(originalContent, replaces);
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
            await handleFileToolCall(toolName || '', partialArgs, true);
          } catch (e) {
            console.error("解析_partial_args失败:", e);
          }
        } else {
          // 处理完整的args
          await handleFileToolCall(toolName || '', args, false);
        }
      }
    }
  };

  return { processFileToolCalls };
};
