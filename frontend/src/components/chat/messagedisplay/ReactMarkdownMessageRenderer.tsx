import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import type { HTMLAttributes, ReactNode } from 'react';

interface CustomLinkProps extends HTMLAttributes<HTMLAnchorElement> {
  href?: string;
  children?: ReactNode;
}

interface CustomCodeBlockProps extends HTMLAttributes<HTMLElement> {
  node?: unknown;
  inline?: boolean | undefined;
  className?: string | undefined;
  children?: ReactNode;
}

interface CustomTableCellProps extends HTMLAttributes<HTMLElement> {
  isHeader?: boolean | undefined;
  children?: ReactNode;
}

interface CustomBlockquoteProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

interface ImgProps extends HTMLAttributes<HTMLImageElement> {
  src?: string | undefined;
  alt?: string | undefined;
}

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children?: ReactNode;
}

interface ParagraphProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

interface ListProps extends HTMLAttributes<HTMLUListElement | HTMLOListElement> {
  children?: ReactNode;
}

interface ListItemProps extends HTMLAttributes<HTMLLIElement> {
  children?: ReactNode;
}

// 自定义链接组件，确保链接在新窗口打开
const CustomLink = ({ href, children, ...props }: CustomLinkProps) => (
  <a 
    href={href} 
    target="_blank" 
    rel="noopener noreferrer"
    {...props}
  >
    {children}
  </a>
);

// 自定义代码块组件，使用简单的语法高亮
const CustomCodeBlock = ({ node, inline, className, children, ...props }: CustomCodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  if (inline) {
    // 内联代码 - 使用反引号包裹的文本
    return (
      <code
        style={{
          backgroundColor: '#2a2a2a',
          color: '#e0e0e0',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '0.9em',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          border: '1px solid #444',
        }}
        {...props}
      >
        {children}
      </code>
    );
  }

  // 代码块 - 使用三个反引号包裹的文本
  return (
    <pre
      style={{
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        padding: '1em',
        borderRadius: '4px',
        overflow: 'auto',
        fontSize: '0.9em',
        lineHeight: '1.4',
        margin: '0.5em 0',
        border: '1px solid #333',
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      }}
      {...props}
    >
      <code className={`language-${language}`}>
        {code}
      </code>
    </pre>
  );
};

// 自定义表格组件，添加更好的样式
const CustomTable = ({ children, ...props }: CustomBlockquoteProps) => (
  <div style={{ overflowX: 'auto', margin: '1em 0' }}>
    <table
      style={{
        borderCollapse: 'collapse',
        width: '100%',
        border: '1px solid #444',
      }}
      {...props}
    >
      {children}
    </table>
  </div>
);

// 自定义表格单元格组件
const CustomTableCell = ({ isHeader, children, ...props }: CustomTableCellProps) => {
  const Component = isHeader ? 'th' : 'td';
  return (
    <Component
      style={{
        border: '1px solid #444',
        padding: '8px 12px',
        textAlign: 'left',
        backgroundColor: isHeader ? '#2a2a2a' : 'transparent',
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

// 自定义块引用组件
const CustomBlockquote = ({ children, ...props }: CustomBlockquoteProps) => (
  <blockquote
    style={{
      borderLeft: '4px solid #666',
      margin: '1em 0',
      paddingLeft: '1em',
      color: '#aaa',
      fontStyle: 'italic',
    }}
    {...props}
  >
    {children}
  </blockquote>
);

interface ReactMarkdownMessageRendererProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  className?: string;
  isStreaming?: boolean;
}

// 主渲染器组件
const ReactMarkdownMessageRenderer = ({
  value = '',
  className = '',
  isStreaming = false,
  ...props
}: ReactMarkdownMessageRendererProps) => {
  const processedValue = () => {
    if (!value) return '';
    
    // 处理一些常见的markdown格式问题
    return value
      .replace(/\\n/g, '\n') // 处理转义的换行符
      .replace(/^```(\w+)?\s*\n/gm, '```$1\n') // 标准化代码块开始标记
      .replace(/\n```$/gm, '\n```'); // 标准化代码块结束标记
  };

  const components = () => ({
    // 链接组件
    a: CustomLink as any,
    
    // 代码块组件
    code: ({ node, inline, className, children, ...props }: CustomCodeBlockProps) => (
      <CustomCodeBlock
        node={node}
        inline={inline ?? false}
        className={className ?? ''}
        children={children}
        {...props}
      />
    ),
    
    // 表格相关组件
    table: CustomTable,
    th: ({ children, ...props }: CustomTableCellProps) => (
      <CustomTableCell isHeader={true} children={children} {...props} />
    ),
    td: ({ children, ...props }: CustomTableCellProps) => (
      <CustomTableCell isHeader={false} children={children} {...props} />
    ),
    
    // 块引用
    blockquote: CustomBlockquote,
    
    // 图片组件 - 添加加载错误处理
    img: ({ src, alt, ...props }: ImgProps) => {
      // 对于placeholder.com的图片，替换为本地默认图片或隐藏
      if (src && src.includes('via.placeholder.com')) {
        return (
          <div
            style={{
              maxWidth: '100%',
              height: '150px',
              backgroundColor: '#444',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#aaa',
              fontStyle: 'italic',
              margin: '0.5em 0'
            }}
            {...props}
          >
            {alt || '图片'}
          </div>
        );
      }
      
      return (
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '4px',
          }}
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'max-width:100%;height:150px;background-color:#444;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#aaa;font-style:italic;margin:0.5em 0';
            placeholder.textContent = alt || '图片加载失败';
            if (target.parentNode) {
              target.parentNode.insertBefore(placeholder, target.nextSibling);
            }
          }}
          {...props}
        />
      );
    },
    
    // 标题组件 - 添加锚点支持
    h1: ({ children, ...props }: HeadingProps) => (
      <h1 style={{ margin: '1em 0 0.5em 0' }} {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: HeadingProps) => (
      <h2 style={{ margin: '1em 0 0.5em 0' }} {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: HeadingProps) => (
      <h3 style={{ margin: '1em 0 0.5em 0' }} {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: HeadingProps) => (
      <h4 style={{ margin: '1em 0 0.5em 0' }} {...props}>
        {children}
      </h4>
    ),
    h5: ({ children, ...props }: HeadingProps) => (
      <h5 style={{ margin: '1em 0 0.5em 0' }} {...props}>
        {children}
      </h5>
    ),
    h6: ({ children, ...props }: HeadingProps) => (
      <h6 style={{ margin: '1em 0 0.5em 0' }} {...props}>
        {children}
      </h6>
    ),
    // 段落组件 - 总是使用div而不是p，以避免嵌套问题
    p: ({ children, ...props }: ParagraphProps) => (
      <div style={{ margin: '0.5em 0', lineHeight: '1.6' }} {...props}>
        {children}
      </div>
    ),
    
    // 列表组件
    ul: ({ children, ...props }: ListProps) => (
      <ul style={{ margin: '0.5em 0', paddingLeft: '1.5em' }} {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: ListProps) => (
      <ol style={{ margin: '0.5em 0', paddingLeft: '1.5em' }} {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: ListItemProps) => (
      <li style={{ margin: '0.25em 0', lineHeight: '1.6' }} {...props}>
        {children}
      </li>
    ),
  });

  return (
    <div
      className={`react-markdown-renderer ${className} ${isStreaming ? 'streaming' : ''}`}
      style={{
        fontSize: '14px',
        lineHeight: '1.6',
        color: '#e0e0e0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '100%',
        overflow: 'hidden',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
      }}
      {...props}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw, rehypeSlug]}
        components={components() as any}
        skipHtml={false}
      >
        {processedValue()}
      </ReactMarkdown>
      
      {/* 流式传输时的加载指示器 */}
      {isStreaming && (
        <div 
          style={{
            display: 'inline-block',
            width: '4px',
            height: '14px',
            backgroundColor: '#666',
            marginLeft: '2px',
            animation: 'blink 1s infinite',
          }}
        />
      )}
    </div>
  );
};

// 添加CSS动画
const styles = `
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.react-markdown-renderer {
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.react-markdown-renderer pre {
  margin: 0.5em 0;
}

.react-markdown-renderer code:not(pre code) {
  background: #2a2a2a;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}

.react-markdown-renderer table {
  border-collapse: collapse;
  width: 100%;
}

.react-markdown-renderer th,
.react-markdown-renderer td {
  border: 1px solid #444;
  padding: 8px 12px;
  text-align: left;
}

.react-markdown-renderer th {
  background-color: #2a2a2a;
}

.react-markdown-renderer blockquote {
  border-left: 4px solid #666;
  margin: 1em 0;
  padding-left: 1em;
  color: #aaa;
  font-style: italic;
}

/* 为段落(div)添加样式，因为我们将p替换为div */
.react-markdown-renderer div[style*="margin: 0.5em 0"] {
  display: block;
}
`;

// 动态添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default ReactMarkdownMessageRenderer;
