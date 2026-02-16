import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import { setModeExpanded, setSelectedModeId } from '../../../store/chat';
import httpClient from '../../../utils/httpClient';

const ModePanel = () => {
  const dispatch = useDispatch();
  const expanded = useSelector((state: RootState) => state.chatSlice.modeExpanded);
  const selectedModeId = useSelector((state: RootState) => state.chatSlice.selectedModeId);
  const allModesData = useSelector((state: RootState) => state.modeSlice.allModesData);

  // 切换模式
  const handleSelectMode = async (modeId: string) => {
    try {
      // 先更新后端配置
      await httpClient.put('/api/mode/current', { name: modeId });
      // 从后端获取最新配置
      const currentModeValue = await httpClient.get('/api/mode/current');
      // 用后端返回的结果更新Redux状态
      dispatch(setSelectedModeId(currentModeValue));
      dispatch(setModeExpanded(false));
    } catch (error) {
      console.error('设置模式失败:', error);
    }
  };

  if (!expanded) return null;

  return (
    <div className="absolute bottom-[60px] left-0 right-0 bg-theme-black border border-theme-gray1 rounded-small shadow-lg max-h-[300px] overflow-y-auto z-[101]">
      {/* 模式列表 */}
      {Object.entries(allModesData).map(([id, mode]) => (
        <div
          key={id}
          className={`flex items-center p-2 hover:bg-theme-gray1 cursor-pointer ${selectedModeId === id ? 'bg-theme-gray1' : ''}`}
          onClick={() => handleSelectMode(id)}
        >
          <span className="text-theme-white text-[14px]">{mode.name}</span>
        </div>
      ))}
    </div>
  );
};

export default ModePanel;
