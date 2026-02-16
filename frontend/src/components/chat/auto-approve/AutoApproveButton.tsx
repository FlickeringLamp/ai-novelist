import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import type { RootState } from '../../../store/store';
import { setAutoApproveEnabled } from '../../../store/chat';
import httpClient from '../../../utils/httpClient';

const AutoApprovePanel = () => {
  const dispatch = useDispatch();
  const enabled = useSelector((state: RootState) => state.chatSlice.autoApproveEnabled);

  // 挂载时从后端获取配置
  useEffect(() => {
    const fetchAutoApproveConfig = async () => {
      try {
        const response = await httpClient.get('/api/chat/auto-approve');
        dispatch(setAutoApproveEnabled(response.enabled));
      } catch (error) {
        console.error('获取自动批准配置失败:', error);
      }
    };
    fetchAutoApproveConfig();
  }, [dispatch]);

  const handleClick = async () => {
    const newEnabled = !enabled;
    
    try {
      const response = await httpClient.post('/api/chat/auto-approve', {
        enabled: newEnabled
      });
      dispatch(setAutoApproveEnabled(response.enabled));
    } catch (error) {
      console.error('保存自动批准配置失败:', error);
    }
  };

  return (
    <div className="relative flex flex-1 box-border items-center justify-center">
      <div
        className="relative group"
        title="自动批准"
      >
        <div
          className={`w-12 h-6 rounded-full cursor-pointer transition-all duration-300 ${
            enabled ? 'bg-theme-green' : 'bg-theme-gray2'
          }`}
          onClick={handleClick}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-md ${
              enabled ? 'left-7' : 'left-1'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default AutoApprovePanel;
