import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import MessageDisplayPanel from './MessageDisplayPanel';
import ToolRequestPanel from './ToolRequestPanel';
import HistoryPanel from './HistoryPanel';

const MiddlePart = () => {
  const selectedThreadId = useSelector((state: RootState) => state.chatSlice.selectedThreadId);
  const historyExpanded = useSelector((state: RootState) => state.chatSlice.historyExpanded);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {selectedThreadId ? (
        <>
          <MessageDisplayPanel />
          <ToolRequestPanel />
        </>
      ) : (
        <>
          {!historyExpanded && (
            <div className="absolute top-[20%] w-full h-[40%] z-50">
              <HistoryPanel />
            </div>
          )}
          {historyExpanded && (
            <div className="absolute inset-0 z-50 bg-theme-gray2">
              <HistoryPanel />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MiddlePart;
