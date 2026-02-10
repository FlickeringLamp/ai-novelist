import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { selectCurrentTokens } from '../../store/chat';

const ContextProgressBar = () => {
  // 从Redux获取状态
  const allProvidersData = useSelector((state: RootState) => state.providerSlice.allProvidersData);
  const selectedProviderId = useSelector((state: RootState) => state.providerSlice.selectedProviderId);
  const selectedModelId = useSelector((state: RootState) => state.providerSlice.selectedModelId);
  const allModesData = useSelector((state: RootState) => state.modeSlice.allModesData);
  const selectedModeId = useSelector((state: RootState) => state.modeSlice.selectedModeId);
  
  // 从Redux获取当前使用的tokens
  const currentTokens = useSelector(selectCurrentTokens);

  // 计算当前模型的最大上下文长度
  const getModelContextLength = (): number => {
    if (!selectedProviderId || !selectedModelId) return 4096;
    const providerData = allProvidersData[selectedProviderId as string];
    if (!providerData) return 4096;
    const contextLength = providerData.favoriteModels?.chat?.[selectedModelId as string];
    return typeof contextLength === 'number' ? contextLength : 4096;
  };

  // 计算当前模式的max_tokens
  const getModeMaxTokens = (): number => {
    if (!selectedModeId || !allModesData[selectedModeId]) return 4096;
    return allModesData[selectedModeId].max_tokens || 4096;
  };

  const modelContextLength = getModelContextLength();
  const modeMaxTokens = getModeMaxTokens();

  // 计算模式max_tokens在模型上下文中的百分比位置
  const modePercentage = (modeMaxTokens / modelContextLength) * 100;

  return (
    <div className="px-2.5 py-1.5 border-b border-theme-gray1">
      <div className="flex items-center gap-2">
        <span className="text-theme-white text-[12px] whitespace-nowrap">上下文占用:</span>
        <div className="flex-1 h-4 bg-theme-gray1 rounded-small relative overflow-hidden">
          {/* 背景进度条（模型最大上下文） */}
          <div className="h-full bg-theme-gray3 rounded-small" style={{ width: '100%' }}></div>
          
          {/* 模式max_tokens标记点 */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-theme-green"
            style={{ left: `${modePercentage}%` }}
            title={`模式最大tokens: ${modeMaxTokens.toLocaleString()}`}
          ></div>
          
          {/* 当前使用tokens进度条 */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-theme-green/50 rounded-small transition-all duration-300"
            style={{ width: `${Math.min((currentTokens / modelContextLength) * 100, 100)}%` }}
          ></div>
        </div>
        <span className="text-theme-white text-[12px] whitespace-nowrap">
          {currentTokens.toLocaleString()} / {modelContextLength.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default ContextProgressBar;
