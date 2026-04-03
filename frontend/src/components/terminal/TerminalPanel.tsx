import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTimes, faTerminal } from '@fortawesome/free-solid-svg-icons';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from '../../context/ThemeContext';
import type { TerminalItem } from '../../types';

// 辅助函数：复制选中的文本
async function copySelection(term: Terminal): Promise<void> {
  const selection = term.getSelection();
  if (!selection) return;
  try {
    // navigator是浏览器提供的全局对象，类似window/document等
    await navigator.clipboard.writeText(selection);
  } catch (err) {
    console.error('复制失败:', err);
  }
}

// 辅助函数：从剪贴板粘贴
async function pasteToTerminal(term: Terminal): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (text) term.paste(text);
  } catch (err) {
    console.error('粘贴失败:', err);
  }
}

// 单个终端组件
function TerminalView({
  id,
  isActive
}: {
  id: string;
  isActive: boolean;
}) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // 初始化 xterm - 使用项目主题色
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: theme.black ?? '#000000',
        foreground: theme.green ?? '#00ff00',
        cursor: theme.green ?? '#00ff00',
        selectionBackground: (theme.green ?? '#00ff00') + '40', // 添加透明度
      },
      scrollback: 10000, // 历史记录10000行
    });

    // FitAddon: 用于自动调整终端大小以适应容器
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon); // 加载插件
    term.open(container); // term.open(): 将终端渲染到指定的 DOM 容器中
    
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // 创建 PTY
    const initPTY = async () => {
      try {
        fitAddon.fit(); // // 手动调用 fit() 来触发自适应
        const { cols, rows } = term;
        const result = await window.electron.terminal.invoke('terminal:create', { terminalId: id });
        if (!result.success) {
          term.writeln(`\r\n\x1b[31m创建终端失败: ${result.error}\x1b[0m`); // 设置文本颜色为红色，打印完报错再恢复默认颜色
          return;
        }
        await window.electron.terminal.invoke('terminal:resize', { terminalId: id, cols, rows }); // resize() → 同步前后端尺寸，确保一致
      } catch (error) {
        term.writeln(`\r\n\x1b[31m创建终端失败: ${error}\x1b[0m`);
      }
    };
    initPTY();

    // 为 xterm.js 终端绑定两个核心事件监听器
    // 输入时触发
    const onData = term.onData((data) => window.electron?.terminal.invoke('terminal:write', { terminalId: id, data }));
    // 使用快捷键时触发，domEvent 应该是浏览器自带的东西
    const onKey = term.onKey(async ({ domEvent }) => {
      const mod = domEvent.ctrlKey || domEvent.metaKey; // Ctrl 或 Cmd 键
      if (mod && domEvent.key === 'c' && term.hasSelection()) {
        domEvent.preventDefault();
        await copySelection(term);
      }
      if (mod && domEvent.key === 'v') {
        domEvent.preventDefault();
        await pasteToTerminal(term);
      }
    });
    // 订阅：监听后端 PTY 进程的输出数据，当pty产生输出时，会调用回调，把内容返回到这里
    const unsubData = window.electron?.terminal.on(`terminal:data:${id}`, (data) => term.write(data)) || (() => {});
    // 订阅：监听 PTY 进程退出事件，pty产生退出信息时，触发
    const unsubExit = window.electron?.terminal.on(`terminal:exit:${id}`, () => {
      term.writeln('\r\n\n[进程已退出，按 Enter 关闭]');
    }) || (() => {});

    // 浏览器内置的原生 JavaScript API ResizeObserver，用于监听 DOM 元素的尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      if (!document.body.contains(container)) return;
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        window.electron?.terminal.invoke('terminal:resize', { terminalId: id, cols, rows });
      } catch {}
    });
    // 让ResizeObserver开始监听指定DOM元素，一旦尺寸变化，ResizeObserver的回调函数就会执行
    resizeObserver.observe(container);

    return () => {
      onData.dispose();
      onKey.dispose();
      unsubData();
      unsubExit();
      resizeObserver.disconnect();
      window.electron?.terminal.invoke('terminal:kill', { terminalId: id });
      term.dispose();
    };
  }, [id]);

  // 激活时重新调整大小
  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          const { cols, rows } = termRef.current!;
          window.electron?.terminal.invoke('terminal:resize', { terminalId: id, cols, rows });
        } catch {}
      }, 100);
    }
  }, [isActive, id]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full px-2 bg-theme-black overflow-hidden"
    />
  );
}

export function TerminalPanel() {
  const [terminals, setTerminals] = useState<TerminalItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 创建新终端
  const createTerminal = useCallback(() => {
    const id = `terminal-${Date.now()}`;
    const name = `终端 ${terminals.length + 1}`;
    setTerminals(prev => [...prev, { id, name }]);
    setActiveId(id);
  }, [terminals.length]);

  // 关闭终端
  const closeTerminal = useCallback((id: string) => {
    setTerminals(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (activeId === id) {
        const idx = prev.findIndex(t => t.id === id);
        setActiveId(filtered[Math.max(0, idx - 1)]?.id || null);
      }
      return filtered;
    });
    window.electron?.terminal.invoke('terminal:kill', { terminalId: id });
  }, [activeId]);

  // 初始创建一个终端
  useEffect(() => {
    if (terminals.length === 0) createTerminal();
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-theme-black border-t border-theme-gray3">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-theme-gray3 bg-theme-gray1">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faTerminal} className="text-theme-green text-sm" />
          <span className="text-theme-white text-sm font-medium">终端</span>
        </div>
        <button
          onClick={createTerminal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-green/20 text-theme-green rounded text-xs hover:bg-theme-green/30 transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
        </button>
      </div>

      {/* 主体 */}
      <div className="flex-1 flex min-h-0">
        {/* 终端显示区域 */}
        <div className="flex-[4] min-w-0 border-r border-theme-gray3 relative">
          {terminals.length === 0 ? (
            <div className="h-full flex items-center justify-center text-theme-gray4">
              <div className="text-center">
                <FontAwesomeIcon icon={faTerminal} className="text-4xl mb-2 opacity-50" />
                <p className="text-sm">没有活动的终端</p>
                <button
                  onClick={createTerminal}
                  className="mt-4 px-4 py-2 bg-theme-green text-theme-black rounded text-sm hover:opacity-90"
                >
                  新建终端
                </button>
              </div>
            </div>
          ) : (
            terminals.map(t => (
              <div
                key={t.id}
                className={`absolute inset-0 h-full w-full ${activeId === t.id ? '' : 'invisible'}`}
              >
                <TerminalView id={t.id} isActive={activeId === t.id} />
              </div>
            ))
          )}
        </div>

        {/* 标签列表 */}
        <div className="w-[160px] flex flex-col bg-theme-gray1 min-w-[140px]">
          <div className="flex-1 overflow-y-auto py-2">
            {terminals.length === 0 ? (
              <div className="px-3 py-4 text-theme-gray4 text-xs text-center">暂无终端</div>
            ) : (
              terminals.map(t => (
                <div
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`group flex items-center gap-2 mx-2 mb-1 px-2 py-2 rounded cursor-pointer
                    ${activeId === t.id
                      ? 'bg-theme-green/20 text-theme-green border-l-2 border-theme-green'
                      : 'text-theme-gray5 hover:bg-theme-gray2 hover:text-theme-white border-l-2 border-transparent'
                    }`}
                >
                  <FontAwesomeIcon 
                    icon={faTerminal} 
                    className={`text-xs ${activeId === t.id ? 'text-theme-green' : 'text-theme-gray4'}`} 
                  />
                  <span className="text-xs truncate flex-1">{t.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); closeTerminal(t.id); }}
                    className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity
                      ${activeId === t.id ? 'hover:bg-theme-green/30 text-theme-green' : 'hover:bg-theme-gray3 text-theme-gray4 hover:text-theme-white'}`}
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-[10px]" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
