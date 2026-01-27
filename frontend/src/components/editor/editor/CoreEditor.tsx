import React, { forwardRef, useRef, useEffect, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import loader from '@monaco-editor/loader';
import type * as Monaco from 'monaco-editor';
import { useTheme } from '../../../context/ThemeContext.tsx';
import { useSelector, useDispatch } from 'react-redux';
import { updateTabContent, saveTabContent, type RootState } from '../../../store/editor.ts';
import api from '../../../utils/httpClient.ts';
import UnifiedModal from '../../others/UnifiedModal';

interface ThemeColors {
  green: string;
  white: string;
  black: string;
  gray2: string;
  gray3: string;
  gray5: string;
}

interface MonacoEditorProps {
  onChange?: (value: string | undefined) => void;
  tabBarId?: string;
}


// 配置 Monaco Editor 使用本地资源
loader.config({
  paths: {
    vs: 'http://127.0.0.1:8000/static/monaco/vs'
  }
});
// 定义自定义主题
const defineTheme = (monaco: typeof Monaco, themeColors: ThemeColors) => {
  monaco.editor.defineTheme('theme-green', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // Markdown 标题的 # 符号
      { token: 'keyword.md', foreground: themeColors.green.replace('#', '') },
      // Markdown 链接 - 这是蓝色的主要来源
      { token: 'string.link.md', foreground: themeColors.green.replace('#', '') },
      // 粗体和斜体
      { token: 'strong', foreground: themeColors.green.replace('#', '') },
      { token: 'emphasis', foreground: themeColors.green.replace('#', '') },
      // 标签<img src="x.jpg">，<div>内容</div>
      { token: 'tag', foreground: themeColors.green.replace('#', '') },
    ],
    colors: {
      'editor.foreground': themeColors.white, // 文字颜色
      'editor.background': themeColors.black, // 背景色
      'editorCursor.foreground': themeColors.green, // 光标颜色
      'editor.lineHighlightBackground': themeColors.gray2, // 当前行高亮色
      'editorLineNumber.foreground': themeColors.gray5, // 行号颜色
      'editorLineNumber.activeForeground': themeColors.green, // 选中行行号颜色
      'editor.selectionBackground': themeColors.green + '85', // 选中背景（添加透明度）
      'editor.inactiveSelectionBackground': themeColors.gray3, // 非活动窗口选中文本背景色
    }
  });
};
// 基础 Monaco 编辑器组件
const CoreEditor = forwardRef<any, MonacoEditorProps>((props, ref) => {
  const { onChange, tabBarId } = props;
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const { theme } = useTheme();
  const dispatch = useDispatch();

  const tabBar = useSelector((state: RootState) => state.tabSlice.tabBars[tabBarId!] || null);
  const activeTab = tabBar?.tabs.find((tab: string) => tab === tabBar?.activeTabId);
  const currentData = useSelector((state: RootState) => state.tabSlice.currentData);
  const value = activeTab ? (currentData[activeTab] || '') : '';
  const [isSaving, setIsSaving] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // 编辑器挂载处理，在挂载后执行
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // 定义自定义主题
    defineTheme(monaco, theme);
    // 应用主题
    monaco.editor.setTheme('theme-green');
    // 保存实例到ref,方便供 "传递给Editor的回调函数"外 的函数访问
    monacoRef.current = monaco;
  };

  // 处理编辑器内容变化
  const handleEditorChange = (newValue: string | undefined) => {
    if (activeTab) {
      dispatch(updateTabContent({ id: activeTab, content: newValue || '' }));
    }
    onChange?.(newValue);
  };

  // 保存当前标签页内容
  const handleSave = async () => {
    if (!activeTab || isSaving) return;

    setIsSaving(true);
    try {
      const content = currentData[activeTab] || '';
      await api.put(`/api/file/update/${encodeURIComponent(activeTab)}`, { content });
      dispatch(saveTabContent({ id: activeTab }));
    } catch (error: any) {
      setErrorModal(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 监听主题变化并更新编辑器主题
  useEffect(() => {
    if (monacoRef.current) {
      defineTheme(monacoRef.current, theme); // 定义
      monacoRef.current.editor.setTheme('theme-green'); // 应用
    }
  }, [theme]);

  // 处理编辑器容器的键盘事件，阻止冒泡到全局监听器
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 检测 Ctrl+S 或 Cmd+S (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    } else {
      e.stopPropagation();
    }
  };
  // 定义暴露给父组件的ref
  React.useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() || '',
    setValue: (content: string) => editorRef.current?.setValue(content),
    insertValue: (content: string) => {
      const editor = editorRef.current;
      if (editor) {
        const position = editor.getPosition();
        if (position) {
          editor.executeEdits('', [{
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            text: content,
          }]);
        }
      }
    },
    focus: () => editorRef.current?.focus(),
    getHTML: () => '',
    getText: () => editorRef.current?.getValue()?.replace(/[#*`\[\]()_~]/g, '').replace(/\n+/g, ' ').trim() || '',
    destroy: () => editorRef.current?.dispose(),
    getMonacoInstance: () => editorRef.current,
  }));
  return (
    <div onKeyDown={handleKeyDown} style={{ height: '100%', position: 'relative' }}>
      {/* 保存状态提示 */}
      {isSaving && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: theme.green,
          color: theme.white,
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          保存中...
        </div>
      )}
      
      {/* 错误提示模态框 */}
      {errorModal && (
        <UnifiedModal
          message={errorModal}
          buttons={[
            { text: '确定', onClick: () => {
              setErrorModal(null);
            }, className: 'bg-theme-green' }
          ]}
        />
      )}
      
      <Editor
        height="100%"
        defaultLanguage="markdown" // 暂时没用，以后根据文件后缀动态切换多语言可能有点用
        language="markdown"
        beforeMount={(monaco) => {
          // 在编辑器挂载前定义主题
          defineTheme(monaco, theme);
        }}
        theme="theme-green"
        value={value}
        onChange={handleEditorChange}
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          handleEditorDidMount(editor, monaco);
        }}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on', // 自动换行（视觉上的自动换行，并非添加换行符）
          automaticLayout: true, // 当容器大小变化时自动重新计算编辑器尺寸
          scrollBeyondLastLine: true, // 允许最后一行向上滚动，直到视窗顶部
          tabSize: 2,
          renderWhitespace:"all",
          renderControlCharacters: true,
        }}
      />
    </div>
  );
});

export default CoreEditor
