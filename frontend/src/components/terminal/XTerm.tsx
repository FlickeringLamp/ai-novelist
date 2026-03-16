import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface XTermProps {
  terminalId: string;
  isActive?: boolean;
  onData?: (data: string) => void;
}

export function XTerm({ terminalId, isActive = true, onData }: XTermProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isInitialized = useRef(false);

  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || !window.electronAPI?.terminal || isInitialized.current) {
      return;
    }

    isInitialized.current = true;

    // 初始化 xterm
    term.current = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#000000',
        foreground: '#34eb5c',
        cursor: '#34eb5c',
        selectionBackground: '#34eb5c40',
        black: '#000000',
        brightBlack: '#666666',
        red: '#ff0000',
        brightRed: '#ff4444',
        green: '#34eb5c',
        brightGreen: '#5eff7a',
        yellow: '#eab308',
        brightYellow: '#f5d742',
        blue: '#3b82f6',
        brightBlue: '#60a5fa',
        magenta: '#a855f7',
        brightMagenta: '#c084fc',
        cyan: '#06b6d4',
        brightCyan: '#22d3ee',
        white: '#ffffff',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    fitAddon.current = new FitAddon();
    term.current.loadAddon(fitAddon.current);
    term.current.open(terminalRef.current);
    
    // 初始调整大小
    try {
      fitAddon.current.fit();
    } catch (e) {
      console.warn('初始调整大小失败:', e);
    }

    const { cols, rows } = term.current;

    // 创建终端进程
    try {
      const result = await window.electronAPI.terminal.create(terminalId, undefined, undefined);
      if (!result.success) {
        term.current.writeln(`\r\n\x1b[31m创建终端失败: ${result.error}\x1b[0m`);
        return;
      }
      
      // 设置大小
      await window.electronAPI.terminal.resize(terminalId, cols, rows);
    } catch (error) {
      console.error('创建终端失败:', error);
      term.current.writeln(`\r\n\x1b[31m创建终端失败: ${error}\x1b[0m`);
      return;
    }

    // 监听输入并发送给 PTY
    const onDataDisposable = term.current.onData((data) => {
      window.electronAPI?.terminal.write(terminalId, data);
      onData?.(data);
    });

    // 监听 PTY 输出
    const unsubscribeData = window.electronAPI.terminal.onData(terminalId, (data) => {
      term.current?.write(data);
    });

    // 监听进程退出
    const unsubscribeExit = window.electronAPI.terminal.onExit(terminalId, () => {
      term.current?.writeln('\r\n\n[进程已退出，按 Enter 关闭]');
    });

    // 监听大小变化
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && term.current) {
        try {
          fitAddon.current.fit();
          const { cols, rows } = term.current;
          window.electronAPI?.terminal.resize(terminalId, cols, rows);
        } catch (e) {
          // 忽略调整大小时的错误
        }
      }
    });
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    cleanupRef.current = () => {
      onDataDisposable.dispose();
      unsubscribeData();
      unsubscribeExit();
      resizeObserver.disconnect();
      window.electronAPI?.terminal.kill(terminalId);
      term.current?.dispose();
    };
  }, [terminalId, onData]);

  useEffect(() => {
    initTerminal();

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      isInitialized.current = false;
    };
  }, [initTerminal]);

  // 当标签页激活时重新调整大小
  useEffect(() => {
    if (isActive && fitAddon.current && term.current) {
      setTimeout(() => {
        try {
          fitAddon.current?.fit();
          const { cols, rows } = term.current!;
          window.electronAPI?.terminal.resize(terminalId, cols, rows);
        } catch (e) {
          // 忽略错误
        }
      }, 100);
    }
  }, [isActive, terminalId]);

  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full p-2"
      style={{ 
        backgroundColor: '#000000',
        overflow: 'hidden'
      }}
    />
  );
}
