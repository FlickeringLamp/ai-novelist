import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import {
  setAllModesData,
  setSelectedModeId,
} from '../../store/mode';
import ModeContextMenu from './modals/ModeContextMenu';
import NotificationModal from './modals/NotificationModal';
import CustomModeModal from './modals/CustomModeModal';
import RenameModeModal from './modals/RenameModeModal';
import DeleteModeConfirmModal from './modals/DeleteModeConfirmModal';
import httpClient from '../../utils/httpClient';

interface ModeListPanelProps {}

const ModeListPanel = ({}: ModeListPanelProps) => {
  const dispatch = useDispatch();

  // 从 Redux 获取数据
  const modesData = useSelector((state: RootState) => state.modeSlice.allModesData);
  const selectedModeId = useSelector((state: RootState) => state.modeSlice.selectedModeId);

  // 自定义模式模态框状态
  const [showCustomModeModal, setShowCustomModeModal] = useState(false);

  // 通知弹窗状态
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // 右键菜单相关状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    modeId: string | null;
  }>({ visible: false, x: 0, y: 0, modeId: null });

  // 重命名相关状态
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [modeToRename, setModeToRename] = useState('');

  // 删除确认模态框相关状态
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [modeToDelete, setModeToDelete] = useState('');

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, modeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      modeId
    });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu({ ...contextMenu, visible: false, modeId: null });
  };

  // 处理删除模式
  const handleDeleteMode = (modeId: string) => {
    setModeToDelete(modeId);
    setShowDeleteConfirmModal(true);
    closeContextMenu();
  };

  // 确认删除模式
  const confirmDeleteMode = async (modeId: string) => {
    try {
      const modeName = modesData[modeId]?.name || modeId;
      // 删除模式
      await httpClient.delete(`/api/mode/custom-modes/${modeId}`);

      // 刷新模式列表
      const modesResult = await httpClient.get('/api/mode/modes');
      dispatch(setAllModesData(modesResult));
      setNotificationMessage(`模式 "${modeName}" 删除成功`);
      setShowNotification(true);
    } catch (error) {
      setNotificationMessage(`删除失败: ${(error as Error).message}`);
      setShowNotification(true);
    } finally {
      dispatch(setSelectedModeId(null));
      setShowDeleteConfirmModal(false);
      setModeToDelete('');
    }
  };

  // 处理重命名模式
  const handleRenameMode = (modeId: string) => {
    setModeToRename(modeId);
    setShowRenameModal(true);
    closeContextMenu();
  };

  // 处理自定义模式提交
  const handleCustomModeSubmit = async (name: string) => {
    try {
      await httpClient.post('/api/mode/custom-modes', { name: name });

      // 刷新模式列表
      const modesResult = await httpClient.get('/api/mode/modes');
      dispatch(setAllModesData(modesResult));

      // 关闭模态框
      setShowCustomModeModal(false);

      // 显示成功通知
      setNotificationMessage('自定义模式添加成功');
      setShowNotification(true);
    } catch (error) {
      setNotificationMessage(`添加失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 确认重命名模式
  const confirmRenameMode = async (modeId: string, newName: string) => {
    try {
      if (!newName.trim()) {
        setNotificationMessage('模式名称不能为空');
        setShowNotification(true);
        return;
      }

      const currentName = modesData[modeId]?.name || modeId;
      if (newName === currentName) {
        setShowRenameModal(false);
        return;
      }

      // 更新模式名称
      await httpClient.put(`/api/mode/custom-modes/${modeId}`, {
        name: newName
      });

      // 刷新模式列表
      const modesResult = await httpClient.get('/api/mode/modes');
      dispatch(setAllModesData(modesResult));

      setNotificationMessage(`模式重命名成功`);
      setShowNotification(true);
      setShowRenameModal(false);
    } catch (error) {
      setNotificationMessage(`重命名失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  return (
    <Panel defaultSize={15} minSize={0} maxSize={100} className="h-full flex flex-col">
      {/* 自定义模式按钮 */}
      <div className="p-1 border-b border-theme-gray3">
        <button
          onClick={() => setShowCustomModeModal(true)}
          className="w-full px-4 py-2 rounded hover:bg-theme-gray2 hover:text-theme-green"
        >
          新建模式
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Object.keys(modesData).map((modeId, index) => (
          <div
            key={index}
            className={`p-2 m-1 cursor-pointer border-1 border-theme-gray3 hover:bg-theme-gray2 hover:text-theme-green ${
              selectedModeId === modeId ? 'bg-theme-gray2 text-theme-green' : ''
            }`}
            onClick={() => dispatch(setSelectedModeId(modeId))}
            onContextMenu={(e) => handleContextMenu(e, modeId)}
          >
            {modesData[modeId]?.name || modeId}
          </div>
        ))}
      </div>

      {/* 通知弹窗 */}
      {showNotification && (
        <NotificationModal
          message={notificationMessage}
          onClose={() => setShowNotification(false)}
        />
      )}

      {/* 自定义模式模态框 */}
      <CustomModeModal
        isOpen={showCustomModeModal}
        onClose={() => setShowCustomModeModal(false)}
        onSubmit={handleCustomModeSubmit}
      />

      {/* 右键菜单 */}
      <ModeContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        modeId={contextMenu.modeId}
        modesData={modesData}
        onRename={handleRenameMode}
        onDelete={handleDeleteMode}
        onClose={closeContextMenu}
      />

      {/* 重命名模态框 */}
      <RenameModeModal
        isOpen={showRenameModal}
        modeId={modeToRename}
        currentName={modesData[modeToRename]?.name || modeToRename}
        onClose={() => setShowRenameModal(false)}
        onSubmit={confirmRenameMode}
      />

      {/* 删除确认模态框 */}
      <DeleteModeConfirmModal
        isOpen={showDeleteConfirmModal}
        modeId={modeToDelete}
        modeName={modesData[modeToDelete]?.name || modeToDelete}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDeleteMode}
      />
    </Panel>
  );
};

export default ModeListPanel;
