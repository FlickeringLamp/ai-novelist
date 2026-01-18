import { DiffEditor } from '@monaco-editor/react';
// Diff 查看器组件
const MonacoDiffViewer = ({ originalContent, currentContent }) => {
  return (
    <div className="w-full h-full">
      <DiffEditor
        height="100%"
        language="markdown"
        theme="vs-dark"
        original={originalContent || ''}
        modified={currentContent || ''}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          enableSplitViewResizing: true,
          renderSideBySide: true,
        }}
      />
    </div>
  );
};

export default MonacoDiffViewer