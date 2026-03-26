import UnifiedModal from '../../others/UnifiedModal.tsx';
import { useDispatch } from 'react-redux';
import { saveTabContent, decreaseTab } from '../../../store/editor.ts';
import api from '../../../utils/httpClient.ts';
import { useFetchFileTree } from '../../../utils/fileTreeHelper.ts';
import type { CloseTabConfirmModalProps } from '@/types';

const CloseTabConfirmModal = ({ tabId, tabBarId, tabContent, onClose, onError }: CloseTabConfirmModalProps) => {
  const dispatch = useDispatch();
  const fetchFileTree = useFetchFileTree();

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
              // 保存后重新获取文件树列表
              await fetchFileTree();
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
          onClick: async () => {
            dispatch(decreaseTab({ tabId }));
            // 丢弃后重新获取文件树列表
            await fetchFileTree();
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
