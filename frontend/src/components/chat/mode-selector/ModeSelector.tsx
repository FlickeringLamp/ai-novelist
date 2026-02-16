import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../../store/store';
import { setAllModesData } from '../../../store/mode';
import { setSelectedModeId, toggleModeExpanded } from '../../../store/chat';
import httpClient from '../../../utils/httpClient';

const ModeSelectorPanel = () => {
  const dispatch = useDispatch();
  
  // 从Redux获取展开状态
  const expanded = useSelector((state: RootState) => state.chatSlice.modeExpanded);
  // 从Redux获取当前选中的模式ID
  const selectedModeId = useSelector((state: RootState) => state.chatSlice.selectedModeId);
  const allModesData = useSelector((state: RootState) => state.modeSlice.allModesData);

  // 加载模式数据
  useEffect(() => {
    const loadModes = async () => {
      try {
        const modesResult = await httpClient.get('/api/mode/modes');
        dispatch(setAllModesData(modesResult));
        
        // 加载当前选中的模式
        const currentModeValue = await httpClient.get('/api/mode/current');
        if (currentModeValue) {
          dispatch(setSelectedModeId(currentModeValue));
        }
      } catch (error) {
        console.error('加载模式数据失败:', error);
      }
    };
    loadModes();
  }, []);

  // 获取当前模式名称
  const currentModeName = allModesData && selectedModeId ? allModesData[selectedModeId]?.name : '未选择模式';

  return (
    <div className="relative flex flex-1 box-border">
      <div
        className="flex items-center justify-center w-full p-2 bg-theme-black border border-theme-gray1 rounded-small cursor-pointer transition-all min-h-[36px] box-border hover:border-theme-green hover:bg-theme-gray1 gap-1"
        onClick={() => dispatch(toggleModeExpanded())}
      >
        <FontAwesomeIcon icon={expanded ? faAngleUp : faAngleRight} className="text-theme-white text-[12px]" />
        <span className="text-theme-white text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{currentModeName}</span>
      </div>
    </div>
  );
};

export default ModeSelectorPanel;
