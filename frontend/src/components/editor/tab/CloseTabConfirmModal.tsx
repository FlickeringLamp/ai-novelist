import UnifiedModal from '../../others/UnifiedModal.tsx';
import { useDispatch } from 'react-redux';
import { saveTabContent, decreaseTab } from '../../../store/editor.ts';
import api from '../../../utils/httpClient.ts';

interface CloseTabConfirmModalProps {
  tabId: string | null;
  tabBarId: string | null;
  tabContent: string;
  onClose: () => void;
  onError: (error: string) => void;
}

const CloseTabConfirmModal = ({ tabId, tabBarId, tabContent, onClose, onError }: CloseTabConfirmModalProps) => {
  const dispatch = useDispatch();

  if (!tabId || !tabBarId) return null;

  return (
    <UnifiedModal
      message="确定关闭吗？存在未保存的更改"
      buttons={[
        {
          text: '保存',
          onClick: async () => {
            try {
              await api.put(`/api/file/update/${encodeURIComponent(tabId)}`, { content: tabContent });
              dispatch(saveTabContent({ id: tabId }));
              dispatch(decreaseTab({ tabId }));
              onClose();
            } catch (error: any) {
              console.error("保存失败：", error);
              onClose();
              onError(`保存失败: ${error.message}`);
            }
          },
          className: 'bg-theme-green'
        },
        {
          text: '丢弃',
          onClick: () => {
            dispatch(decreaseTab({ tabId }));
            onClose();
          },
          className: 'bg-theme-gray5'
        },
        {
          text: '取消',
          onClick: () => {
            onClose();
          },
          className: 'bg-theme-gray3'
        }
      ]}
    />
  );
};

export default CloseTabConfirmModal;
