import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { setAllProvidersData } from "../../store/provider";
import { setKnowledgeBases, setSelectedKnowledgeBaseId } from "../../store/knowledge";
import httpClient from "../../utils/httpClient";
import RenameBaseModal from "./modals/RenameBaseModal";
import DeleteBaseConfirmModal from "./modals/DeleteBaseConfirmModal";
import AddKnowledgeBaseModal from "./modals/AddKnowledgeBaseModal";
import BaseContextMenu from "./modals/BaseContextMenu";
import UnifiedModal from "../others/UnifiedModal";

interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  knowledgeBaseId: string | null;
}

const BaseListPanel = () => {
  const dispatch = useDispatch();
  const { knowledgeBases, selectedKnowledgeBaseId } = useSelector(
    (state: RootState) => state.knowledgeSlice
  );

  const providerData = useSelector(
    (state: RootState) => state.providerSlice.allProvidersData,
  );

  const getEnabledProviders = () => {
    const result: {
      [key: string]: {
        name: string;
        embedding: { [key: string]: any };
      };
    } = {};
    for (const [id, provider] of Object.entries(providerData)) {
      if (provider.enable) {
        result[id] = {
          name: provider.name,
          embedding: provider.favoriteModels.embedding,
        };
      }
    }
    return result;
  };

  const enableProvider = getEnabledProviders();

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenu>({
    visible: false,
    x: 0,
    y: 0,
    knowledgeBaseId: null
  });

  // 模态框状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [knowledgeBaseToRename, setKnowledgeBaseToRename] = useState('');
  const [knowledgeBaseToDelete, setKnowledgeBaseToDelete] = useState('');

  // 挂载时从后端获取提供商数据和知识库数据
  useEffect(() => {
    const fetchData = async () => {
      const providers = await httpClient.get('/api/provider/providers');
      if (providers) {
        dispatch(setAllProvidersData(providers));
      }

      const kb = await httpClient.get('/api/knowledge/bases');
      if (kb) {
        dispatch(setKnowledgeBases(kb));
      }
    };
    fetchData();
  }, []);

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, knowledgeBaseId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      knowledgeBaseId
    });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu({ ...contextMenu, visible: false, knowledgeBaseId: null });
  };

  // 处理删除知识库（打开确认框）
  const handleDeleteKnowledgeBase = (knowledgeBaseId: string) => {
    setKnowledgeBaseToDelete(knowledgeBaseId);
    setShowDeleteConfirmModal(true);
    closeContextMenu();
  };

  // 确认删除知识库
  const confirmDeleteKnowledgeBase = async (knowledgeBaseId: string) => {
    try {
      const knowledgeBaseName = knowledgeBases[knowledgeBaseId]?.name || knowledgeBaseId;
      await httpClient.delete(`/api/knowledge/bases/${knowledgeBaseId}`);

      const kb = await httpClient.get('/api/knowledge/bases');
      if (kb) {
        dispatch(setKnowledgeBases(kb));
      }

      if (selectedKnowledgeBaseId === knowledgeBaseId) {
        dispatch(setSelectedKnowledgeBaseId(null));
      }

      setNotificationMessage(`知识库 "${knowledgeBaseName}" 删除成功`);
      setShowNotification(true);
    } catch (error) {
      setNotificationMessage(`删除失败: ${(error as Error).message}`);
      setShowNotification(true);
    } finally {
      setShowDeleteConfirmModal(false);
      setKnowledgeBaseToDelete('');
    }
  };

  // 处理重命名知识库（打开重命名框）
  const handleRenameKnowledgeBase = (knowledgeBaseId: string) => {
    setKnowledgeBaseToRename(knowledgeBaseId);
    setShowRenameModal(true);
    closeContextMenu();
  };

  // 确认重命名知识库
  const confirmRenameKnowledgeBase = async (knowledgeBaseId: string, newName: string) => {
    try {
      if (!newName.trim()) {
        setNotificationMessage('知识库名称不能为空');
        setShowNotification(true);
        return;
      }

      const currentName = knowledgeBases[knowledgeBaseId]?.name || knowledgeBaseId;
      if (newName === currentName) {
        setShowRenameModal(false);
        return;
      }

      await httpClient.put(`/api/knowledge/bases/${knowledgeBaseId}`, {
        name: newName
      });

      const kb = await httpClient.get('/api/knowledge/bases');
      if (kb) {
        dispatch(setKnowledgeBases(kb));
      }

      setNotificationMessage(`知识库重命名成功`);
      setShowNotification(true);
      setShowRenameModal(false);
    } catch (error) {
      setNotificationMessage(`重命名失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  return (
    <div className="w-[20%] h-full flex flex-col border-r border-theme-gray3">
      <div className="p-1 border-b border-theme-gray3">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full px-4 py-2 rounded hover:bg-theme-gray2 hover:text-theme-green"
        >
          添加知识库
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Object.entries(knowledgeBases).map(([id, kb]) => (
          <div
            key={id}
            onClick={() => dispatch(setSelectedKnowledgeBaseId(id))}
            onContextMenu={(e) => handleContextMenu(e, id)}
            className={`p-4 cursor-pointer border-b border-theme-gray2 hover:bg-theme-gray2 hover:text-theme-green ${
              selectedKnowledgeBaseId === id ? 'bg-theme-gray2 text-theme-green' : ''
            }`}
          >
            <div className="font-medium">{kb.name}</div>
            <div className="text-sm text-theme-gray4">{enableProvider[kb.provider]?.name}/{kb.model}</div>
          </div>
        ))}
      </div>

      {/* 右键菜单 */}
      <BaseContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        knowledgeBaseId={contextMenu.knowledgeBaseId}
        onRename={handleRenameKnowledgeBase}
        onDelete={handleDeleteKnowledgeBase}
        onClose={closeContextMenu}
      />

      {/* 添加知识库模态框 */}
      <AddKnowledgeBaseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {/* 通知弹窗 */}
      {showNotification && (
        <UnifiedModal
          message={notificationMessage}
          buttons={[
            {
              text: "确定",
              onClick: () => setShowNotification(false),
              className: "bg-theme-green"
            }
          ]}
        />
      )}

      {/* 重命名模态框 */}
      <RenameBaseModal
        isOpen={showRenameModal}
        knowledgeBaseId={knowledgeBaseToRename}
        currentName={knowledgeBases[knowledgeBaseToRename]?.name || knowledgeBaseToRename}
        onClose={() => setShowRenameModal(false)}
        onSubmit={confirmRenameKnowledgeBase}
      />

      {/* 删除确认模态框 */}
      <DeleteBaseConfirmModal
        isOpen={showDeleteConfirmModal}
        knowledgeBaseId={knowledgeBaseToDelete}
        knowledgeBaseName={knowledgeBases[knowledgeBaseToDelete]?.name || knowledgeBaseToDelete}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDeleteKnowledgeBase}
      />
    </div>
  );
};

export default BaseListPanel;
