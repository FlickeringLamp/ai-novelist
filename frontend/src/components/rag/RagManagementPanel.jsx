import { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import httpClient from '../../utils/httpClient';
import { filterEmbeddingModels } from '../../utils/embeddingModelUtils';

const RagSettingsPanel = () =>{
  const [activeTab, setActiveTab] = useState('embedding'); // 默认显示嵌入配置标签
  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [embeddingModels, setEmbeddingModels] = useState([]);
  const [selectedEmbeddingModelId, setSelectedEmbeddingModelId] = useState(null);
  const [embeddingDimensions, setEmbeddingDimensions] = useState(null)
  const [chunkSize, setChunkSize] = useState("")
  const [chunkOverlap, setChunkOverlap] = useState("")
  const [ragFile, setRagFile] = useState([])
  const [uploadStatus, setUploadStatus] = useState('')
  const [renamingFileId, setRenamingFileId] = useState(null)
  const [newFileName, setNewFileName] = useState('')
  const fileInputRef = useRef(null)

  useEffect(()=>{
    const initializeData = async() => {
      const [providersResult, chunkSettingsResult] = await Promise.all([
        httpClient.get('/api/provider/providers'),
        httpClient.get('/api/embedding/rag/chunk-settings'),
      ]);
      setProviders(providersResult || []);
      setChunkSize(chunkSettingsResult.chunkSize || "");
      setChunkOverlap(chunkSettingsResult.chunkOverlap || "")
    };
      initializeData();
  },[]);

  useEffect(()=>{
    const fetchEmbeddingModels = async() => {
      if (selectedProviderId) {
        const response = await httpClient.get(`/api/provider/${selectedProviderId}/models`);
        const embeddingList = filterEmbeddingModels(response.models || []);
        setEmbeddingModels(embeddingList);
      }
    };
    fetchEmbeddingModels();
  },[selectedProviderId]);

  useEffect(()=>{
    const fetchKnowledgeBaseFiles = async() => {
      const response = await httpClient.get('/api/embedding/rag/files');
      setRagFile(response.files || []);
    };
    fetchKnowledgeBaseFiles();
  },[])

  const handleProviderClick = (providerId) => {
    setSelectedProviderId(providerId);
  };

  const handleEmbeddingModelClick = async (modelId) => {
    setSelectedEmbeddingModelId(modelId);
    try {
      const modelInfo = `${selectedProviderId}:${modelId}`;
      const response = await httpClient.post('/api/embedding/dimensions', {
        model_info: modelInfo
      });
      setEmbeddingDimensions(response.dimensions || "");
    } catch (error) {
      console.error('获取嵌入维度失败:', error);
      setEmbeddingDimensions("");
    }
  };

  const handleSubmit = async(e) => {
    e.preventDefault();
    try {
      const response = await httpClient.post('/api/embedding/rag/chunk-settings', {
        chunkSize: parseInt(chunkSize),
        chunkOverlap: parseInt(chunkOverlap)
      });
      console.log('RAG分块设置保存成功');
    } catch (error) {
      console.error('保存RAG分块设置时发生错误:', error);
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setUploadStatus('正在上传文件...')

    try {
      const formData = new FormData();
      formData.append('file', file);
      await httpClient.post('/api/embedding/rag/files', formData);

      setUploadStatus(`文件 "${file.name}" 上传成功！`)
      const fileListResult = await httpClient.get('/api/embedding/rag/files');
      setRagFile(fileListResult.files || [])
    } catch (error) {
      console.error('文件上传过程中发生错误:', error)
      setUploadStatus(`文件上传失败: ${error.message}`)
    }

    event.target.value = ''

    setTimeout(() => {
      setUploadStatus('')
    }, 3000)
  }

  const handleDeleteFile = async (fileId) => {
    try {
      await httpClient.delete(`/api/embedding/rag/files/${fileId}`);

      console.log('文件删除成功');
      const fileListResult = await httpClient.get('/api/embedding/rag/files');
      setRagFile(fileListResult.files || []);
    } catch (error) {
      console.error('文件删除过程中发生错误:', error);
    }
  }

  const handleRenameFile = async (fileId) => {
    if (!newFileName.trim()) {
      console.error('文件名不能为空');
      return;
    }

    try {
      await httpClient.put(`/api/embedding/rag/files/${fileId}/rename`, null, {
        params: { new_name: newFileName }
      });

      console.log('文件重命名成功');
      const fileListResult = await httpClient.get('/api/embedding/rag/files');
      setRagFile(fileListResult.files || []);
      setRenamingFileId(null);
      setNewFileName('');
    } catch (error) {
      console.error('文件重命名过程中发生错误:', error);
    }
  }

  const startRenameFile = (file) => {
    setRenamingFileId(file.id);
    setNewFileName(file.name);
  }

  const cancelRenameFile = () => {
    setRenamingFileId(null);
    setNewFileName('');
  }

  return(
    <div className='w-full h-[932px] p-2.5'>
      <div className='flex border-b border-theme-gray1'>
        <button
          className={`px-4 py-2 border border-theme-gray1 bg-theme-gray1 text-theme-white cursor-pointer rounded-tl-small rounded-tr-small ${activeTab === 'embedding' ? 'bg-theme-green text-white' : ''}`}
          onClick={() => setActiveTab('embedding')}
        >
          嵌入配置
        </button>
        <button
          className={`px-4 py-2 border border-theme-gray1 bg-theme-gray1 text-theme-white cursor-pointer rounded-tl-small rounded-tr-small ${activeTab === 'knowledge' ? 'bg-theme-green text-white' : ''}`}
          onClick={() => setActiveTab('knowledge')}
        >
          RAG知识库
        </button>
      </div>

      <div className='p-2.5'>
        {activeTab === 'embedding' && (
          <div className='flex flex-col'>
            <PanelGroup direction="horizontal" className="h-[85%]">
              {/* 左侧提供商列表面板 */}
              <Panel defaultSize={25} minSize={20} maxSize={40} className="border border-theme-gray1 flex flex-col">
                <div className="overflow-y-auto flex-1 p-1.25">
                  {providers.map((provider, index) => (
                    <div
                      key={index}
                      className={`m-2.5 p-2.5 text-center cursor-pointer bg-theme-gray1 ${selectedProviderId === provider ? "border border-theme-green text-theme-green":""}`}
                      onClick={() => handleProviderClick(provider)}
                    >
                      {provider}
                    </div>
                  ))}
                </div>
              </Panel>
              <PanelResizeHandle className="w-1.25 bg-theme-gray1 cursor-col-resize relative transition-colors hover:bg-theme-gray1 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-0.5 after:h-5 after:bg-theme-gray1 after:rounded-[1px]" />
              {/* 右侧模型列表面板 */}
              <Panel className='border border-theme-gray1 flex flex-col'>
                <div className="p-2.5 border-b border-theme-gray1">
                  <h3>模型列表</h3>
                </div>
                <div className='overflow-y-auto flex-1 p-1.25'>
                  {embeddingModels.length === 0 ? (
                    <div className='text-theme-white text-center'>
                      未找到此提供商的嵌入模型
                    </div>
                  ) : (
                    embeddingModels.map((embeddingModel,index)=>(
                      <div
                        key={index}
                        className={`m-2.5 p-2.5 text-center cursor-pointer bg-theme-gray1 ${selectedEmbeddingModelId === embeddingModel.id?'border border-theme-green text-theme-green':''}`}
                        onClick={()=> handleEmbeddingModelClick(embeddingModel.id)}
                      >
                        {embeddingModel.id}
                      </div>
                    ))
                  )}
                </div>

                {/* 嵌入维度显示框 */}
                <div className="border border-theme-gray1 rounded-small m-2.5 p-2.5">
                  <div className="p-2.5 border-b border-theme-gray1 mb-2.5">
                    <h3>嵌入维度</h3>
                  </div>
                  <div className="p-2.5 text-center rounded-small bg-theme-gray1">
                    {embeddingDimensions ? (
                      <div className="text-theme-green text-xl">{embeddingDimensions}</div>
                    ) : (
                      <div className="text-theme-white">请选择模型</div>
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className='flex flex-col'>
            <div className='border border-theme-gray1 rounded-small p-2.5 mb-2.5'>
              <h3 className="m-0 mb-2.5">切分设置</h3>
              <form onSubmit={handleSubmit}>
                <label htmlFor='chunk_size' className="block m-2.5">切分长度:</label>
                <input
                  type='text'
                  id='chunk_size'
                  className='block m-2.5 p-2 border border-theme-gray1 rounded-small bg-theme-gray1 text-theme-white'
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  placeholder='请输入切分长度'
                />
                <label htmlFor='chunk_overlap' className="block m-2.5">重叠长度:</label>
                <input
                  type='text'
                  id='chunk_overlap'
                  className='block m-2.5 p-2 border border-theme-gray1 rounded-small bg-theme-gray1 text-theme-white'
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(e.target.value)}
                  placeholder='请输入重叠长度'
                />
                <button type='submit' className='block m-2.5 px-4 py-2 bg-theme-green text-white border-none rounded-small cursor-pointer'>确定</button>
              </form>
            </div>

            <div className='border border-theme-gray1 rounded-small p-2.5 mb-2.5'>
              <h3 className="m-0 mb-2.5">文件上传</h3>
              <input
                type='file'
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept='.txt,.md,.pdf,.doc,.docx'
              />
              <button
                className='block m-2.5 px-4 py-2 bg-theme-green text-white border-none rounded-small cursor-pointer'
                onClick={handleFileSelect}
              >
                添加文件到知识库
              </button>
              {uploadStatus && (
                <div className='m-2.5 p-2 rounded-small text-center text-sm'>
                  {uploadStatus}
                </div>
              )}
            </div>

            <div className='border border-theme-gray1 rounded-small p-2.5'>
              <h3 className="m-0 mb-2.5">文件列表</h3>
              {ragFile.map((file,index)=>(
                <div
                  key={index}
                  className='border border-theme-gray1 rounded-small p-2.5 mb-2.5 flex justify-between items-center'
                >
                  <div className='flex flex-col gap-1'>
                    {renamingFileId === file.id ? (
                      <div>
                        <input
                          type="text"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          placeholder="输入新文件名"
                          className="p-2 border border-theme-gray1 rounded-small bg-theme-gray1 text-theme-white"
                        />
                        <button className="m-2.5 px-3 py-1 bg-theme-green text-white border-none rounded-small cursor-pointer" onClick={() => handleRenameFile(file.id)}>确认</button>
                        <button className="m-2.5 px-3 py-1 bg-gray-600 text-white border-none rounded-small cursor-pointer" onClick={cancelRenameFile}>取消</button>
                      </div>
                    ) : (
                      <div>文件名: {file.name}</div>
                    )}
                    <div>片段数: {file.total_chunks}</div>
                    <div>切分长度: {file.chunk_size}</div>
                    <div>重叠长度: {file.chunk_overlap}</div>
                    <div>嵌入维度: {file.dimensions}</div>
                  </div>
                  <div>
                    <button
                      className='m-2.5 px-3 py-1 bg-theme-green text-white border-none rounded-small cursor-pointer'
                      onClick={() => startRenameFile(file)}
                      title='重命名文件'
                      disabled={renamingFileId !== null}
                    >
                      重命名
                    </button>
                    <button
                      className='m-2.5 px-3 py-1 bg-red-500 text-white border-none rounded-small cursor-pointer'
                      onClick={() => handleDeleteFile(file.id)}
                      title='删除文件'
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

};
export default RagSettingsPanel;
