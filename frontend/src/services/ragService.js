// RAG 服务 - 负责知识库管理、文件上传、检索设置等操作
import httpClient from '../utils/httpClient.js';
import globalProviderService from './providerService.js'

class RagService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 添加文件到知识库
   * @param {File} file - 文件对象
   * @returns {Promise<Object>} 添加结果
   */
  async addFileToKnowledgeBase(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 不手动设置Content-Type，让浏览器自动设置multipart/form-data和boundary
      const response = await httpClient.post('/api/embedding/rag/files', formData);
      return {
        success: true,
        data: response,
        message: response.message || '文件已成功添加到知识库'
      };
    } catch (error) {
      console.error('添加文件到知识库失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取嵌入维度
   * @param {string} modelInfo - 模型信息，格式为"模型提供商：模型id"
   * @returns {Promise<Object>} 嵌入维度数据
   */
  async getEmbeddingDimensions(modelInfo) {
    try {
      const response = await httpClient.post('/api/embedding/dimensions', {
        model_info: modelInfo
      });
      
      // 确保response存在
      if (!response) {
        throw new Error('API响应为空');
      }
      
      // 处理不同的响应格式
      let responseData;
      if (response.data) {
        responseData = response.data;
      } else if (response.success !== undefined) {
        // 如果响应本身就是数据对象
        responseData = response;
      } else {
        throw new Error('API响应格式不正确');
      }
      
      return {
        success: responseData.success !== undefined ? responseData.success : true,
        dimensions: responseData.dimensions || 1024,
        message: responseData.message || '获取嵌入维度成功',
        modelId: modelInfo
      };
    } catch (error) {
      console.error('获取嵌入维度失败:', error);
      return {
        success: false,
        error: '获取嵌入维度失败: ' + error.message,
        dimensions: 1024 // 默认维度
      };
    }
  }

  /**
   * 获取嵌入模型列表 - 调用provider服务
   * @param {string} provider_id - 提供商ID
   * @returns {Promise} 嵌入模型列表
   */
  async getEmbeddingModels(provider_id) {
    const response = await globalProviderService.getProviderModels(provider_id);
    
    // 检查响应是否成功
    if (!response.success) {
      return {
        success: false,
        error: response.error || '获取模型列表失败',
        data: []
      };
    }
    
    // 过滤嵌入模型
    const embedding_list = this._filterEmbeddingModels(response.data || []);
    return {
      success: true,
      data: embedding_list,
      message: `已获取 ${embedding_list.length} 个嵌入模型`
    };
  }

  /**
   * 只保留嵌入模型
   * @param {Array} models - 模型列表
   * @returns {Array} 过滤后的嵌入模型列表
   */
  _filterEmbeddingModels(models) {
    if (!Array.isArray(models)) {
      console.warn('_filterEmbeddingModels: 输入不是数组', models);
      return [];
    }

    return models.filter(model => {
      const modelName = model.id || '';
      const isEmbeddingModel = this._isEmbeddingModel(modelName);
      
      if (!isEmbeddingModel) {
        console.log(`过滤掉非嵌入模型: ${modelName}`);
      }
      
      return isEmbeddingModel;
    });
  }

  /**
   * 判断是否为嵌入模型
   * @param {string} modelName - 模型名称
   * @returns {boolean} 是否为嵌入模型
   */
  _isEmbeddingModel(modelName) {
    if (!modelName) {
      return false;
    }

    // 重排序模型的关键词 - 需要排除的模型
    const rerankKeywords = [
      'rerank',
      'reranker'
    ];

    // 嵌入模型的关键词
    const embeddingKeywords = [
      'embedding',
      'embed',
      'text-embedding',
      'bge-', // 常见的中文嵌入模型前缀
      'e5-',  // 常见的嵌入模型前缀
      'sentence-transformers',
      'qwen3-embedding' // 添加特定的qwen3嵌入模型
    ];

    // 检查模型名称是否包含重排序模型的关键词
    const lowerModelName = modelName.toLowerCase();
    
    // 如果包含重排序关键词，则不是嵌入模型
    if (rerankKeywords.some(keyword => lowerModelName.includes(keyword))) {
      return false;
    }

    // 检查模型名称是否包含嵌入模型的关键词
    return embeddingKeywords.some(keyword => lowerModelName.includes(keyword));
  }

  /**
   * 获取知识库文件列表
   * @returns {Promise<Object>} 文件列表数据
   */
  async listKnowledgeBaseFiles() {
    try {
      const response = await httpClient.get('/api/embedding/rag/files');
      console.log("文件列表",response.files)
      return {
        success: true,
        files: response.files || [],
        message: '知识库文件列表获取成功'
      };
    } catch (error) {
      console.error('获取知识库文件列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        files: []
      };
    }
  }

  /**
   * 删除知识库文件
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteKnowledgeBaseFile(fileId) {
    try {
      const response = await httpClient.delete(`/api/embedding/rag/files/${fileId}`);
      return {
        success: response.success || true,
        data: response,
        message: response.message || '知识库文件删除成功'
      };
    } catch (error) {
      console.error('删除知识库文件失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 重命名知识库文件
   * @param {string} fileId - 文件ID
   * @param {string} newName - 新名称
   * @returns {Promise<Object>} 重命名结果
   */
  async renameKnowledgeBaseFile(fileId, newName) {
    try {
      const response = await httpClient.put(`/api/embedding/rag/files/${fileId}/rename`, null, {
        params: { new_name: newName }
      });
      return {
        success: response.success || true,
        data: response,
        message: response.message || '知识库文件重命名成功'
      };
    } catch (error) {
      console.error('重命名知识库文件失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }


  /**
   * 获取 RAG 分块设置
   * @returns {Promise<Object>} 分块设置数据
   */
  async getRagChunkSettings() {
    console.log('开始获取RAG分块设置...');
    try {
      console.log('准备发送请求到: /api/embedding/rag/chunk-settings');
      const response = await httpClient.get('/api/embedding/rag/chunk-settings');
      console.log('收到响应:', response);
      
      return response;
    } catch (error) {
      console.error('获取RAG分块设置失败:', error);
      console.error('错误详情:', error.stack);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        chunkSize: 100,
        chunkOverlap: 20
      };
    }
  }

  /**
   * 保存 RAG 分块设置
   * @param {number} chunkSize - 分块大小
   * @param {number} chunkOverlap - 分块重叠大小
   * @returns {Promise<Object>} 保存结果
   */
  async saveRagChunkSettings(chunkSize, chunkOverlap) {
    console.log('开始保存RAG分块设置...', { chunkSize, chunkOverlap });
    try {
      const response = await httpClient.post('/api/embedding/rag/chunk-settings', {
        chunkSize: parseInt(chunkSize),
        chunkOverlap: parseInt(chunkOverlap)
      });
      console.log('保存RAG分块设置响应:', response);
      
      return response;
    } catch (error) {
      console.error('保存RAG分块设置失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        chunkSize: chunkSize,
        chunkOverlap: chunkOverlap
      };
    }
  }
}
 
// 创建全局 RAG 服务实例
const ragService = new RagService();

export default ragService;