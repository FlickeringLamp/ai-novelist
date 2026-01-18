import React, { forwardRef, useRef } from 'react';
import Editor from '@monaco-editor/react';
import loader from '@monaco-editor/loader';


// 配置 Monaco Editor 使用本地资源
loader.config({
  paths: {
    vs: 'http://127.0.0.1:8000/static/monaco/vs'
  }
});

// 基础 Monaco 编辑器组件
const MonacoEditor = forwardRef((props, ref) => {
  // @ts-ignore
  const { value = '', onChange, onInstanceReady = null } = props;
  const editorRef = useRef(null);

  const handleEditorDidMount = (editor) => {
    if (onInstanceReady) {
      onInstanceReady(editor);
    }
  };

  React.useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() || '',
    setValue: (content) => editorRef.current?.setValue(content),
    insertValue: (content) => {
      const editor = editorRef.current;
      if (editor) {
        const position = editor.getPosition();
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
    },
    focus: () => editorRef.current?.focus(),
    getHTML: () => '',
    getText: () => editorRef.current?.getValue()?.replace(/[#*`\[\]()_~]/g, '').replace(/\n+/g, ' ').trim() || '',
    destroy: () => editorRef.current?.dispose(),
    getMonacoInstance: () => editorRef.current,
  }));

  return (
    <Editor
      height="100%"
      defaultLanguage="markdown"
      language="markdown"
      theme="vs-dark"
      value={value}
      onChange={onChange}
      onMount={(editor) => {
        editorRef.current = editor;
        handleEditorDidMount(editor);
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
      }}
    />
  );
});

export default MonacoEditor