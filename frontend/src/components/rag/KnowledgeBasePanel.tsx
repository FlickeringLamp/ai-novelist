import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { setAllProvidersData } from "../../store/provider";
import UnifiedModal from "../others/UnifiedModal";
import httpClient from "../../utils/httpClient";
import KnowledgeBaseContextMenu from "./modals/KnowledgeBaseContextMenu";
import RenameKnowledgeBaseModal from "./modals/RenameKnowledgeBaseModal";
import DeleteKnowledgeBaseConfirmModal from "./modals/DeleteKnowledgeBaseConfirmModal";

const KnowledgeBasePanel = () => {
  const dispatch = useDispatch();
  const [enableProvider, setEnableProvider] = useState<{
    [key: string]: {
      name: string;
      embedding: { [key: string]: any };
    };
  }>({})
  const [knowledgeBases, setKnowledgeBases] = useState<{
    [key: string]: {
      name: string;
      provider: string;
      model: string;
      chunkSize: number;
      overlapSize: number;
      similarity: number;
      returnDocs: number;
    };
  }>({})
  const [showModal, setShowModal] = useState(false);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  
  // 文件列表状态
  const [files, setFiles] = useState<Array<{ name: string; size: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 知识库详情弹窗状态
  const [showDetailModal, setShowDetailModal] = useState(false);

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

  // 处理删除知识库
  const handleDeleteKnowledgeBase = (knowledgeBaseId: string) => {
    setKnowledgeBaseToDelete(knowledgeBaseId);
    setShowDeleteConfirmModal(true);
    closeContextMenu();
  };

  // 确认删除知识库
  const confirmDeleteKnowledgeBase = async (knowledgeBaseId: string) => {
    try {
      const knowledgeBaseName = knowledgeBases[knowledgeBaseId]?.name || knowledgeBaseId;
      // 删除知识库
      await httpClient.delete(`/api/knowledge/bases/${knowledgeBaseId}`);

      // 刷新知识库列表
      const kb = await httpClient.get('/api/knowledge/bases');
      if (kb) {
        setKnowledgeBases(kb);
      }

      // 如果删除的是当前选中的知识库，清除选中状态
      if (selectedKnowledgeBaseId === knowledgeBaseId) {
        setSelectedKnowledgeBaseId(null);
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

  // 处理重命名知识库
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

      // 更新知识库名称
      await httpClient.put(`/api/knowledge/bases/${knowledgeBaseId}`, {
        name: newName
      });

      // 刷新知识库列表
      const kb = await httpClient.get('/api/knowledge/bases');
      if (kb) {
        setKnowledgeBases(kb);
      }

      setNotificationMessage(`知识库重命名成功`);
      setShowNotification(true);
      setShowRenameModal(false);
    } catch (error) {
      setNotificationMessage(`重命名失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 处理知识库字段更新
  const handleFieldUpdate = async (knowledgeBaseId: string, field: string, value: string) => {
    try {
      const kb = knowledgeBases[knowledgeBaseId];
      if (!kb) return;

      let parsedValue: number;
      
      // 根据字段类型解析值
      if (field === 'similarity') {
        parsedValue = parseFloat(value);
      } else {
        parsedValue = parseInt(value);
      }

      // 验证值
      if (isNaN(parsedValue)) {
        setNotificationMessage('请输入有效的数字');
        setShowNotification(true);
        return;
      }

      // 调用后端API更新
      await httpClient.put(`/api/knowledge/bases/${knowledgeBaseId}`, {
        [field]: parsedValue
      });

      // 刷新知识库列表
      const updatedKb = await httpClient.get('/api/knowledge/bases');
      if (updatedKb) {
        setKnowledgeBases(updatedKb);
      }
    } catch (error) {
      setNotificationMessage(`更新失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 打开弹窗时，自动设置第一个可用的嵌入模型
  const handleOpenModal = () => {
    const allModels = getAllEmbeddingModelOptions();
    if (allModels.length > 0 && allModels[0]) {
      setEmbeddingModel(allModels[0].value);
    }
    setShowModal(true);
  };
  const [chunkSize, setChunkSize] = useState("");
  const [overlapSize, setOverlapSize] = useState("");
  const [similarity, setSimilarity] = useState("");
  const [returnDocs, setReturnDocs] = useState("");

  // 当选中的知识库变化时，更新详情面板的值并加载文件列表
  useEffect(() => {
    if (selectedKnowledgeBaseId && knowledgeBases[selectedKnowledgeBaseId]) {
      const kb = knowledgeBases[selectedKnowledgeBaseId];
      setChunkSize(String(kb.chunkSize));
      setOverlapSize(String(kb.overlapSize));
      setSimilarity(String(kb.similarity));
      setReturnDocs(String(kb.returnDocs));
      
      // 加载知识库的文件列表
      loadKnowledgeBaseFiles(selectedKnowledgeBaseId);
    }
  }, [selectedKnowledgeBaseId, knowledgeBases]);
  
  // 加载知识库的文件列表
  const loadKnowledgeBaseFiles = async (kbId: string) => {
    try {
      const filenames = await httpClient.get(`/api/knowledge/bases/${kbId}/files`);
      if (filenames && Array.isArray(filenames)) {
        setFiles(filenames.map((name: string) => ({ name, size: 0 })));
      }
    } catch (error) {
      console.error('加载文件列表失败:', error);
      setFiles([]);
    }
  };
  
  // 上传文件到知识库
  const uploadFileToKnowledgeBase = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await httpClient.upload(`/api/knowledge/bases/${selectedKnowledgeBaseId}/files`, formData);
      
      setNotificationMessage(`文件 "${file.name}" 上传成功`);
      setShowNotification(true);
      
      // 重新加载文件列表
      if (selectedKnowledgeBaseId) {
        await loadKnowledgeBaseFiles(selectedKnowledgeBaseId);
      }
    } catch (error) {
      setNotificationMessage(`上传失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };
  
  // 删除知识库中的文件
  const deleteFileFromKnowledgeBase = async (filename: string) => {
    try {
      await httpClient.delete(`/api/knowledge/bases/${selectedKnowledgeBaseId}/files/${filename}`);
      
      setNotificationMessage(`文件 "${filename}" 删除成功`);
      setShowNotification(true);
      
      // 重新加载文件列表
      if (selectedKnowledgeBaseId) {
        await loadKnowledgeBaseFiles(selectedKnowledgeBaseId);
      }
    } catch (error) {
      setNotificationMessage(`删除失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 通知弹窗状态
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  // 右键菜单相关状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    knowledgeBaseId: string | null;
  }>({ visible: false, x: 0, y: 0, knowledgeBaseId: null });

  // 重命名相关状态
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [knowledgeBaseToRename, setKnowledgeBaseToRename] = useState('');

  // 删除确认模态框相关状态
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [knowledgeBaseToDelete, setKnowledgeBaseToDelete] = useState('');

  // 挂载时从后端获取提供商数据和知识库数据
  useEffect(() => {
    const fetchData = async () => {
      // 获取提供商数据
      const providers = await httpClient.get('/api/provider/providers');
      if (providers) {
        dispatch(setAllProvidersData(providers));
      }
      
      // 获取知识库数据
      const kb = await httpClient.get('/api/knowledge/bases');
      if (kb) {
        setKnowledgeBases(kb);
      }
    };
    fetchData();
  }, []);

  const providerData = useSelector(
    (state: RootState) => state.providerSlice.allProvidersData,
  );
  console.log("providerData",providerData)

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

  useEffect(() => {
    setEnableProvider(getEnabledProviders());
  }, [providerData]);

  // 获取所有可用的嵌入模型选项
  const getAllEmbeddingModelOptions = () => {
    const options: { label: string; value: string }[] = [];
    for (const [providerId, provider] of Object.entries(enableProvider)) {
      for (const [model, values] of Object.entries(provider.embedding)) {
        options.push({
          label: `${provider.name}/${model}: ${values.dimensions}`,
          value: `${providerId}|${model}`
        });
      }
    }
    return options;
  };

  return (
    <div className="w-full h-full flex">
      {/* 左侧：知识库列表 */}
      <div className="w-[20%] h-full flex flex-col border-r border-theme-gray3">
        <div className="p-1 border-b border-theme-gray3">
          <button
            onClick={handleOpenModal}
            className="w-full px-4 py-2 rounded hover:bg-theme-gray2 hover:text-theme-green"
          >
            添加知识库
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Object.entries(knowledgeBases).map(([id, kb]) => (
            <div
              key={id}
              onClick={() => setSelectedKnowledgeBaseId(id)}
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
      </div>
      
      {/* 右侧：文件列表 */}
      <div className="w-[80%] h-full flex flex-col">
        {selectedKnowledgeBaseId ? (
          <>
            {/* 右上角：添加文件按钮 */}
            <div className="p-4 border-b border-theme-gray3 flex justify-between items-center">
              <h2 className="text-xl font-bold">{knowledgeBases[selectedKnowledgeBaseId]?.name}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetailModal(true)}
                  className="px-4 py-2 rounded bg-theme-gray3 hover:bg-theme-gray2"
                >
                  设置
                </button>
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                  className="px-4 py-2 rounded bg-theme-green text-white hover:bg-opacity-90"
                >
                  添加文件
                </button>
              </div>
            </div>
            
            {/* 文件列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {files.length === 0 ? (
                <div className="flex items-center justify-center h-full text-theme-gray4">
                  暂无文件信息
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="p-3 rounded border border-theme-gray3 hover:bg-theme-gray2 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">{file.name}</div>
                        {file.size > 0 && (
                          <div className="text-sm text-theme-gray4">{(file.size / 1024).toFixed(2)} KB</div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteFileFromKnowledgeBase(file.name)}
                        className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-theme-green">
            请从左侧选择一个知识库
          </div>
        )}
      </div>
      {showModal && (
        <UnifiedModal
          title="添加知识库"
          inputs={[
            {
              label: "名称",
              type: "text",
              value: name,
              onChange: setName,
              placeholder: "请输入知识库名称",
              required: true,
            },
            {
              label: "嵌入模型",
              type: "select",
              value: embeddingModel,
              onChange: setEmbeddingModel,
              options: getAllEmbeddingModelOptions(),
              required: true,
            },
            {
              label: "分段大小",
              type: "text",
              value: chunkSize,
              onChange: setChunkSize,
              placeholder: "请输入分段大小",
              required: true,
            },
            {
              label: "重叠大小",
              type: "text",
              value: overlapSize,
              onChange: setOverlapSize,
              placeholder: "请输入重叠大小",
              required: true,
            },
            {
              label: "相似度",
              type: "text",
              value: similarity,
              onChange: setSimilarity,
              placeholder: "请输入相似度",
              required: true,
            },
            {
              label: "返回文档片段数",
              type: "text",
              value: returnDocs,
              onChange: setReturnDocs,
              placeholder: "请输入返回文档片段数",
              required: true,
            },
          ]}
          buttons={[
            {
              text: "取消",
              onClick: () => setShowModal(false),
              className: "bg-theme-gray3",
            },
            {
              text: "确认",
              onClick: async () => {
                try {
                  // 生成ID（db_时间戳）
                  const id = `db_${Date.now()}`;
                  
                  // 从embeddingModel中提取providerId和modelName
                  const [providerId, modelName] = embeddingModel.split('|');
                  
                  // 获取dimensions
                  const dimensions = enableProvider[providerId as string]?.embedding[modelName as string]?.dimensions;
                  
                  // 构建请求数据
                  const requestData = {
                    id,
                    name,
                    provider: providerId,
                    model: modelName,
                    dimensions,
                    chunkSize: parseInt(chunkSize),
                    overlapSize: parseInt(overlapSize),
                    similarity: parseFloat(similarity),
                    returnDocs: parseInt(returnDocs)
                  };
                  
                  // 调用后端API添加知识库
                  const result = await httpClient.post('/api/knowledge/bases', requestData);
                  if (result) {
                    setKnowledgeBases(result);
                    // 清空表单
                    setName("");
                    setEmbeddingModel("");
                    setChunkSize("");
                    setOverlapSize("");
                    setSimilarity("");
                    setReturnDocs("");
                    setShowModal(false);
                    setNotificationMessage('知识库添加成功');
                    setShowNotification(true);
                  }
                } catch (error) {
                  setNotificationMessage(`添加失败: ${(error as Error).message}`);
                  setShowNotification(true);
                }
              },
              className: "bg-theme-green",
            },
          ]}
        />
      )}

      {/* 通知弹窗 */}
      {showNotification && (
        <UnifiedModal
          title="提示"
          message={notificationMessage}
          buttons={[
            {
              text: "确定",
              onClick: () => setShowNotification(false),
              className: "bg-theme-green",
            },
          ]}
        />
      )}

      {/* 右键菜单 */}
      <KnowledgeBaseContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        knowledgeBaseId={contextMenu.knowledgeBaseId}
        onRename={handleRenameKnowledgeBase}
        onDelete={handleDeleteKnowledgeBase}
        onClose={closeContextMenu}
      />

      {/* 重命名模态框 */}
      <RenameKnowledgeBaseModal
        isOpen={showRenameModal}
        knowledgeBaseId={knowledgeBaseToRename}
        currentName={knowledgeBases[knowledgeBaseToRename]?.name || knowledgeBaseToRename}
        onClose={() => setShowRenameModal(false)}
        onSubmit={confirmRenameKnowledgeBase}
      />

      {/* 删除确认模态框 */}
      <DeleteKnowledgeBaseConfirmModal
        isOpen={showDeleteConfirmModal}
        knowledgeBaseId={knowledgeBaseToDelete}
        knowledgeBaseName={knowledgeBases[knowledgeBaseToDelete]?.name || knowledgeBaseToDelete}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDeleteKnowledgeBase}
      />

      {/* 知识库详情弹窗 */}
      {showDetailModal && selectedKnowledgeBaseId && (
        <div className="fixed top-0 left-0 right-0 bottom-0 flex justify-center items-center z-[1000]">
          <div className="bg-theme-gray1 rounded-medium shadow-medium px-5 py-3.75 max-w-[500px] w-[400px] text-theme-white">
            <h3 className="m-0 text-theme-white text-lg mb-3.75">知识库详细信息</h3>
            <div className="space-y-4">
              <div className="p-4 rounded">
                <div className="text-sm">嵌入维度</div>
                <div className="text-lg font-medium">
                  {enableProvider[knowledgeBases[selectedKnowledgeBaseId!]!.provider]?.embedding?.[knowledgeBases[selectedKnowledgeBaseId!]!.model]?.dimensions || '-'}
                </div>
              </div>
              <div className="p-4 rounded">
                <div className="text-sm">嵌入模型</div>
                <div className="text-lg font-medium">
                  {enableProvider[knowledgeBases[selectedKnowledgeBaseId!]!.provider]?.name}/{knowledgeBases[selectedKnowledgeBaseId]?.model}
                </div>
              </div>
              <div className="p-4 rounded">
                <div className="text-sm">切分大小</div>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  onBlur={(e) => handleFieldUpdate(selectedKnowledgeBaseId!, 'chunkSize', e.target.value)}
                  className="text-lg font-medium w-full bg-transparent border-b border-theme-gray3 focus:border-theme-green outline-none"
                />
              </div>
              <div className="p-4 rounded">
                <div className="text-sm">重叠大小</div>
                <input
                  type="number"
                  value={overlapSize}
                  onChange={(e) => setOverlapSize(e.target.value)}
                  onBlur={(e) => handleFieldUpdate(selectedKnowledgeBaseId!, 'overlapSize', e.target.value)}
                  className="text-lg font-medium w-full bg-transparent border-b border-theme-gray3 focus:border-theme-green outline-none"
                />
              </div>
              <div className="p-4 rounded">
                <div className="text-sm">相似度阈值</div>
                <input
                  type="number"
                  step="0.01"
                  value={similarity}
                  onChange={(e) => setSimilarity(e.target.value)}
                  onBlur={(e) => handleFieldUpdate(selectedKnowledgeBaseId!, 'similarity', e.target.value)}
                  className="text-lg font-medium w-full bg-transparent border-b border-theme-gray3 focus:border-theme-green outline-none"
                />
              </div>
              <div className="p-4 rounded">
                <div className="text-sm">返回文档片段数</div>
                <input
                  type="number"
                  value={returnDocs}
                  onChange={(e) => setReturnDocs(e.target.value)}
                  onBlur={(e) => handleFieldUpdate(selectedKnowledgeBaseId!, 'returnDocs', e.target.value)}
                  className="text-lg font-medium w-full bg-transparent border-b border-theme-gray3 focus:border-theme-green outline-none"
                />
              </div>
            </div>
            <div className="mt-3.75 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded bg-theme-gray3 hover:bg-theme-gray2"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 隐藏的文件选择输入框 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={async (e) => {
          const selectedFiles = Array.from(e.target.files || []);
          console.log("选择的文件:", selectedFiles);
          
          // 逐个上传文件
          for (const file of selectedFiles) {
            await uploadFileToKnowledgeBase(file);
          }
          
          e.target.value = '';
        }}
        style={{ display: 'none' }}
        multiple
      />
    </div>
  );
};

export default KnowledgeBasePanel;
