import { useState, useCallback, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTimes, faTerminal, faTrash } from '@fortawesome/free-solid-svg-icons';
import { XTerm } from './XTerm';

interface Terminal {
  id: string;
  name: string;
}

interface TerminalPanelProps {
  isVisible: boolean;
}

export function TerminalPanel({ isVisible }: TerminalPanelProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const terminalCounter = useRef(1);

  // 创建新终端
  const createTerminal = useCallback(() => {
    const id = `terminal-${Date.now()}-${terminalCounter.current++}`;
    const name = `终端 ${terminalCounter.current - 1}`;
    
    setTerminals(prev => [...prev, { id, name }]);
    setActiveTerminalId(id);
  }, []);

  // 关闭终端
  const closeTerminal = useCallback((id: string) => {
    setTerminals(prev => {
      const newTerminals = prev.filter(t => t.id !== id);
      
      // 如果关闭的是当前激活的终端，切换到前一个
      if (activeTerminalId === id && newTerminals.length > 0) {
        const index = prev.findIndex(t => t.id === id);
        const newIndex = Math.max(0, index - 1);
        setActiveTerminalId(newTerminals[newIndex]?.id || null);
      } else if (newTerminals.length === 0) {
        setActiveTerminalId(null);
      }
      
      return newTerminals;
    });

    // 通知主进程关闭终端进程
    window.electronAPI?.terminal.kill(id);
  }, [activeTerminalId]);

  // 关闭所有终端
  const closeAllTerminals = useCallback(() => {
    // 通知主进程关闭所有终端
    window.electronAPI?.terminal.killAll();
    setTerminals([]);
    setActiveTerminalId(null);
  }, []);

  // 初始化时创建一个终端
  useEffect(() => {
    if (isVisible && terminals.length === 0) {
      createTerminal();
    }
  }, [isVisible, terminals.length, createTerminal]);

  // 清理所有终端
  useEffect(() => {
    return () => {
      if (terminals.length > 0) {
        window.electronAPI?.terminal.killAll();
      }
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-theme-black border-t border-theme-gray3">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-2 py-1 bg-theme-gray1 border-b border-theme-gray3">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faTerminal} className="text-theme-green text-sm" />
          <span className="text-theme-white text-sm">终端</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={createTerminal}
            className="px-2 py-1 text-theme-green hover:bg-theme-gray2 rounded text-xs flex items-center gap-1 transition-colors"
            title="新建终端"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>新建</span>
          </button>
          {terminals.length > 0 && (
            <button
              onClick={closeAllTerminals}
              className="px-2 py-1 text-theme-red hover:bg-theme-gray2 rounded text-xs flex items-center gap-1 transition-colors"
              title="关闭所有终端"
            >
              <FontAwesomeIcon icon={faTrash} />
              <span>全部关闭</span>
            </button>
          )}
        </div>
      </div>

      {/* 标签栏 */}
      {terminals.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-theme-black border-b border-theme-gray3 overflow-x-auto">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              onClick={() => setActiveTerminalId(terminal.id)}
              className={`
                flex items-center gap-2 px-3 py-1 rounded-t text-xs cursor-pointer
                transition-colors min-w-fit
                ${activeTerminalId === terminal.id 
                  ? 'bg-theme-gray1 text-theme-green border-t-2 border-theme-green' 
                  : 'bg-theme-gray2 text-theme-gray5 hover:bg-theme-gray1 hover:text-theme-white'
                }
              `}
            >
              <FontAwesomeIcon icon={faTerminal} className="text-xs" />
              <span className="truncate max-w-[100px]">{terminal.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(terminal.id);
                }}
                className="ml-1 p-0.5 hover:bg-theme-gray3 rounded text-xs opacity-60 hover:opacity-100"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 终端内容区 */}
      <div className="flex-1 relative overflow-hidden">
        {terminals.length === 0 ? (
          <div className="h-full flex items-center justify-center text-theme-gray4">
            <div className="text-center">
              <FontAwesomeIcon icon={faTerminal} className="text-4xl mb-2 opacity-50" />
              <p className="text-sm">没有活动的终端</p>
              <button
                onClick={createTerminal}
                className="mt-4 px-4 py-2 bg-theme-green text-theme-black rounded text-sm hover:opacity-90 transition-opacity"
              >
                新建终端
              </button>
            </div>
          </div>
        ) : (
          terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={`absolute inset-0 ${activeTerminalId === terminal.id ? 'visible' : 'invisible'}`}
            >
              <XTerm 
                terminalId={terminal.id} 
                isActive={activeTerminalId === terminal.id}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
