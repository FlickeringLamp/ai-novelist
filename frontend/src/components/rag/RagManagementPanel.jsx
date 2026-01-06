import React, { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import httpClient from '../../utils/httpClient';
import { filterEmbeddingModels } from '../../utils/embeddingModelUtils';
import './RagManagementPanel.css';

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
      //:-1+1
      const [providersResult, chunkSettingsResult, embeddingModelsResult] = await Promise.all([
        httpClient.get('/api/provider/providers'),
        httpClient.get('/api/embedding/rag/chunk-settings'),
        //:+1
        httpClient.get('/api/config/store?key=embeddingModels'),
      ]);
      setProviders(providersResult || []);
      setChunkSize(chunkSettingsResult.chunkSize || "");
      setChunkOverlap(chunkSettingsResult.chunkOverlap || "")

      //:+ if
      if (embeddingModelsResult && typeof embeddingModelsResult === 'object') {
        if (embeddingModelsResult.provider) {
          setSelectedProviderId(embeddingModelsResult.provider);
        }
        if (embeddingModelsResult.modelId) {
          setSelectedEmbeddingModelId(embeddingModelsResult.modelId);
        }
        if (embeddingModelsResult.dimensions !== undefined && embeddingModelsResult.dimensions !== null) {
          setEmbeddingDimensions(embeddingModelsResult.dimensions);
        }
      }
    };
      initializeData();
  },[]);

  useEffect(()=>{
    const fetchEmbeddingModels = async() => {
      if (selectedProviderId) {
        const response = await httpClient.get(`/api/provider/${selectedProviderId}/models`);
        //:TODO: 处理响应格式不一致的问题
        const modelsPayload = Array.isArray(response)
          ? response
          : (response && typeof response === 'object' && 'success' in response
            ? (response.data || [])
            : (response?.models || response || []));

        const normalizedModels = Array.isArray(modelsPayload)
          ? modelsPayload.map(m => (typeof m === 'string' ? { id: m } : m)).filter(Boolean)
          : [];

        const embeddingList = filterEmbeddingModels(normalizedModels);
        setEmbeddingModels(embeddingList);
      }
    };
    fetchEmbeddingModels();
  },[selectedProviderId]);

  useEffect(()=>{
    const fetchKnowledgeBaseFiles = async() => {
      const response = await httpClient.get('/api/embedding/rag/files');
      //:-1+4
      const filesPayload = Array.isArray(response)
        ? response
        : (response && typeof response === 'object' ? (response.files || []) : []);
      setRagFile(filesPayload);
    };
    //:+ if
    if (activeTab !== 'knowledge') return;
    fetchKnowledgeBaseFiles();
    //:+ useEffect
  },[activeTab])

  const handleProviderClick = (providerId) => {
    setSelectedProviderId(providerId);

    //:+ httpClient
    httpClient.post('/api/config/store', {
      key: 'embeddingModels',
      value: {
        provider: providerId,
        modelId: selectedEmbeddingModelId || '',
        dimensions: embeddingDimensions || ''
      }
    }).catch(() => {});
  };

  const handleEmbeddingModelClick = async (modelId) => {
    setSelectedEmbeddingModelId(modelId);

    //:+ if
    if (selectedProviderId) {
      httpClient.post('/api/config/store', {
        key: 'embeddingModels',
        value: {
          provider: selectedProviderId,
          modelId,
          dimensions: embeddingDimensions || ''
        }
      }).catch(() => {});
    }

    try {
      const modelInfo = `${selectedProviderId}:${modelId}`;
      const response = await httpClient.post('/api/embedding/dimensions', {
        model_info: modelInfo
      });
      setEmbeddingDimensions(response.dimensions || "");

      //:+ if
      if (selectedProviderId) {
        httpClient.post('/api/config/store', {
          key: 'embeddingModels',
          value: {
            provider: selectedProviderId,
            modelId,
            dimensions: response.dimensions || ""
          }
        }).catch(() => {});
      }
    } catch (error) {
      console.error('获取嵌入维度失败:', error);
      setEmbeddingDimensions("");

      //:+ if
      if (selectedProviderId) {
        httpClient.post('/api/config/store', {
          key: 'embeddingModels',
          value: {
            provider: selectedProviderId,
            modelId,
            dimensions: ""
          }
        }).catch(() => {});
      }
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
    //:+ if
    if (!fileInputRef.current) {
      setUploadStatus('文件选择器未初始化，请刷新页面后重试')
      return
    }
    fileInputRef.current.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setUploadStatus('正在上传文件...')
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      //:-1+1
      await httpClient.upload('/api/embedding/rag/files', formData);
      
      setUploadStatus(`文件 "${file.name}" 上传成功！`)
      const fileListResult = await httpClient.get('/api/embedding/rag/files');
      //:-1+4
      const filesPayload = Array.isArray(fileListResult)
        ? fileListResult
        : (fileListResult && typeof fileListResult === 'object' ? (fileListResult.files || []) : []);
      setRagFile(filesPayload)
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
      //:-1+4
      const filesPayload = Array.isArray(fileListResult)
        ? fileListResult
        : (fileListResult && typeof fileListResult === 'object' ? (fileListResult.files || []) : []);
      setRagFile(filesPayload);
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
      //:-2+2
      await httpClient.put(`/api/embedding/rag/files/${fileId}/rename`, {
        new_name: newFileName
      });
      
      console.log('文件重命名成功');
      const fileListResult = await httpClient.get('/api/embedding/rag/files');
      //:-1+4
      const filesPayload = Array.isArray(fileListResult)
        ? fileListResult
        : (fileListResult && typeof fileListResult === 'object' ? (fileListResult.files || []) : []);
      setRagFile(filesPayload);
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
    <div className='rag-management-panel'>
      <div className='rag-tab-headers'>
        <button
          className={`rag-tab-button ${activeTab === 'embedding' ? 'active' : ''}`}
          onClick={() => setActiveTab('embedding')}
        >
          嵌入配置
        </button>
        <button
          className={`rag-tab-button ${activeTab === 'knowledge' ? 'active' : ''}`}
          onClick={() => setActiveTab('knowledge')}
        >
          RAG知识库
        </button>
      </div>
      
      <div className='tab-content'>
        {activeTab === 'embedding' && (
          <div className='embedding-model-tab'>
            <PanelGroup direction="horizontal" className="embedding-panel-group">
              {/* 左侧提供商列表面板 */}
              <Panel defaultSize={25} minSize={20} maxSize={40} className="provider-list-panel">
                <div className="provider-list">
                  {providers.map((provider, index) => (
                    <div
                      key={index}
                      className={`provider-item ${selectedProviderId === provider ? "selected":""}`}
                      onClick={() => handleProviderClick(provider)}
                    >
                      {provider}
                    </div>
                  ))}
                </div>
              </Panel>
              <PanelResizeHandle className="embedding-panel-resize-handle" />
              {/* 右侧模型列表面板 */}
              <Panel className='emb-model-list-panel'>
                <div className="model-list-header">
                  <h3>模型列表</h3>
                </div>
                <div className='embedding-model-list'>
                  {embeddingModels.length === 0 ? (
                    <div className='empty-models-message'>
                      未找到此提供商的嵌入模型
                    </div>
                  ) : (
                    embeddingModels.map((embeddingModel,index)=>(
                      <div
                        key={index}
                        className={`embedding-model-item ${selectedEmbeddingModelId === embeddingModel.id?'selected':''}`}
                        onClick={()=> handleEmbeddingModelClick(embeddingModel.id)}
                      >
                        {embeddingModel.id}
                      </div>
                    ))
                  )}
                </div>
                
                {/* 嵌入维度显示框 */}
                <div className="embedding-dimensions-container">
                  <div className="dimensions-header">
                    <h3>嵌入维度</h3>
                  </div>
                  <div className="dimensions-display">
                    {embeddingDimensions ? (
                      <div className="dimensions-value">{embeddingDimensions}</div>
                    ) : (
                      <div className="dimensions-placeholder">请选择模型</div>
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </div>
        )}
        
        {activeTab === 'knowledge' && (
          <div className='rag-knowledgebase-tab'>
            <div className='rag-chunk-settings'>
              <h3>切分设置</h3>
              <form onSubmit={handleSubmit}>
                <label htmlFor='chunk_size'>切分长度:</label>
                <input
                  type='text'
                  id='chunk_size'
                  className='chunk_size_input'
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  placeholder='请输入切分长度'
                />
                <label htmlFor='chunk_overlap'>重叠长度:</label>
                <input
                  type='text'
                  id='chunk_overlap'
                  className='chunk_overlap_input'
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(e.target.value)}
                  placeholder='请输入重叠长度'
                />
                <button type='submit' className='chunk-submit-btn'>确定</button>
              </form>
            </div>
            
            <div className='file-upload-section'>
              <h3>文件上传</h3>
              <input
                type='file'
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept='.txt,.md,.pdf,.doc,.docx'
              />
              <button
                className='add-file-btn'
                onClick={handleFileSelect}
              >
                添加文件到知识库
              </button>
              {uploadStatus && (
                <div className='upload-status'>
                  {uploadStatus}
                </div>
              )}
            </div>
            
            <div className='rag-file-list'>
              <h3>文件列表</h3>
              {ragFile.map((file,index)=>(
                <div
                  key={index}
                  className='rag-file-item'
                >
                  <div className='file-info'>
                    {renamingFileId === file.id ? (
                      <div>
                        <input
                          type="text"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          placeholder="输入新文件名"
                        />
                        <button className="confirm-rename-btn" onClick={() => handleRenameFile(file.id)}>确认</button>
                        <button className="cancel-rename-btn" onClick={cancelRenameFile}>取消</button>
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
                      className='rename-file-btn'
                      onClick={() => startRenameFile(file)}
                      title='重命名文件'
                      disabled={renamingFileId !== null}
                    >
                      重命名
                    </button>
                    <button
                      className='delete-file-btn'
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