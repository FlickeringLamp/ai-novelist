import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { setAllModesData } from '../../store/mode';
import ModeListPanel from './ModeListPanel.tsx';
import ModeDetailPanel from './ModeDetailPanel.tsx';
import httpClient from '../../utils/httpClient';

const AgentPanel = () => {
  const dispatch = useDispatch();

  // 挂载时从后端获取模式数据
  useEffect(() => {
    const fetchModes = async () => {
      const result = await httpClient.get('/api/mode/modes');
      if (result) {
        dispatch(setAllModesData(result));
      }
    };
    fetchModes();
  }, []);

  return (
    <div className="w-full h-full">
      <PanelGroup direction="horizontal" className="flex-grow flex h-full overflow-hidden min-h-0">
        {/* 左侧模式列表面板 */}
        <ModeListPanel />
        <PanelResizeHandle className="w-[1px] bg-theme-gray3 cursor-col-resize relative " />
        {/* 右侧模式详情面板 */}
        <ModeDetailPanel/>
      </PanelGroup>
    </div>
  );
};

export default AgentPanel;
