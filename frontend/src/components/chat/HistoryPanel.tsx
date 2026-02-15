import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { setHistoryExpanded, setSelectedThreadId } from '../../store/chat';
import httpClient from '../../utils/httpClient';

interface Session {
  session_id: string;
  message_count: number;
  created_at: number | null;
  last_accessed: number | null;
  preview: string;
}

const HistoryPanel = () => {
  const dispatch = useDispatch();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  // 从Redux获取当前thread_id和历史面板展开状态
  const currentThreadId = useSelector((state: RootState) => state.chatSlice.state?.config?.configurable?.thread_id);
  const expanded = useSelector((state: RootState) => state.chatSlice.historyExpanded);

  // 加载会话列表
  const loadSessions = async () => {
    try {
      setLoading(true);
      const result = await httpClient.get('/api/history/sessions');
      if (result && result.sessions) {
        setSessions(result.sessions);
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // 加载指定会话
  const handleLoadSession = async (threadId: string) => {
    try {
      // 切换到指定会话
      const result = await httpClient.post('/api/chat/update-thread', { thread_id: threadId });
      // 重新加载状态
      const initialState = await httpClient.get('/api/chat/state');
      if (initialState && initialState.values) {
        initialState.values.messages = initialState.values.messages || [];
      }
      dispatch({ type: 'chatSlice/setState', payload: initialState });
      // 从后端返回的结果中获取thread_id
      const actualThreadId = result?.thread_id;
      dispatch(setSelectedThreadId(actualThreadId));
      console.log("切换会话成功，thread_id:", actualThreadId);
    } catch (error) {
      console.error('切换会话失败:', error);
    }
  };

  // 显示的会话列表（展开时显示全部，否则显示前4个）
  const displaySessions = expanded ? sessions : sessions.slice(0, 4);

  // 格式化时间戳
  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* 标题栏 */}
      <div className="flex justify-between items-center p-3">
        <h3 className="text-theme-white font-bold text-lg">最近对话</h3>
        {!expanded && (
          <button
            onClick={() => dispatch(setHistoryExpanded(true))}
            className="text-theme-green text-sm hover:text-theme-white transition-colors"
          >
            查看更多
          </button>
        )}
        {expanded && (
          <button
            onClick={() => dispatch(setHistoryExpanded(false))}
            className="text-theme-green text-sm hover:text-theme-white transition-colors"
          >
            收起
          </button>
        )}
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-theme-gray3 text-center">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="text-theme-gray3 text-center">暂无历史对话</div>
        ) : (
          <div className={`flex flex-col gap-2 ${!expanded && 'items-center'}`}>
            {displaySessions.map((session) => (
              <div
                key={session.session_id}
                onClick={() => handleLoadSession(session.session_id)}
                className={`p-3 bg-theme-gray1 border border-theme-green rounded-small cursor-pointer transition-all hover:border-theme-white hover:bg-theme-gray2 ${
                  session.session_id === currentThreadId ? 'border-theme-white bg-theme-gray2' : ''
                } ${!expanded ? 'w-[80%]' : 'w-full'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-theme-white font-medium text-sm truncate flex-1">
                    {session.preview || '无标题'}
                  </span>
                  {session.last_accessed && (
                    <span className="text-theme-gray3 text-xs ml-2 whitespace-nowrap">
                      {formatTimestamp(session.last_accessed)}
                    </span>
                  )}
                </div>
                <div className="text-theme-gray3 text-xs">
                  {session.message_count} 条消息
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;
