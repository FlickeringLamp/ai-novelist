import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { setAllProvidersData } from '../../store/provider';
import ProviderListPanel from './ProviderListPanel';
import ModelListPanel from './ModelListPanel';
import httpClient from '../../utils/httpClient';

const ProviderSettingsPanel = () => {
  const dispatch = useDispatch();

  // 挂载时从后端获取提供商数据
  useEffect(() => {
    const fetchProviders = async () => {
      const result = await httpClient.get('/api/provider/providers');
      if (result) {
        dispatch(setAllProvidersData(result));
      }
    };
    fetchProviders();
  }, []);

  return (
    <div className="w-full h-full">
      <PanelGroup direction="horizontal" className="flex-grow flex h-full overflow-hidden min-h-0">
        {/* 左侧提供商列表面板 */}
        <ProviderListPanel />
        <PanelResizeHandle className="w-[1px] bg-theme-gray3 cursor-col-resize relative " />
        {/* 右侧模型列表面板 */}
        <ModelListPanel/>
      </PanelGroup>
    </div>
  );
};

export default ProviderSettingsPanel;
