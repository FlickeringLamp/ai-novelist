// 提供商配置服务 - 直接与后端通信，不经过Redux
import httpClient from '../utils/httpClient.js';

class ProviderService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 获取所有提供商
   */
  async getProviders() {
    try {
      const response = await httpClient.get('/api/provider/providers');
      return {
        success: true,
        data: response,
        message: '提供商列表获取成功'
      };
    } catch (error) {
      console.error('获取提供商列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        data: {}
      };
    }
  }

  async getProviderModels(provider_id){
    try{
      const response = await httpClient.get(`/api/provider/${provider_id}/models`)
      console.log(`获取${provider_id}的模型列表响应:`, response);
      
      // 后端返回的数据结构是 {models: [...], count: number}
      // 我们需要返回 models 数组
      const models = response.models || [];
      console.log(`解析出的模型列表:`, models);
      
      return {
        success: true,
        data: models,
        message:`${provider_id}的模型列表获取成功`
      };
    }catch(error){
      console.error(`获取${provider_id}的模型列表失败:`, error)
      // 尝试从错误中获取详细信息
      let errorMessage = 'Http 请求失败： '+ error.message;
      
      // 检查是否是HTTP响应错误
      if (error.response) {
        // 获取HTTP状态码
        const status = error.response.status;
        // 获取错误详情
        if (error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else {
          errorMessage = `请求失败 (HTTP ${status})`;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        data:[]
      };
    }
  }

  /**
   * 获取常用模型列表
   */
  async getFavoriteModels() {
    try {
      const response = await httpClient.get('/api/provider/favorite-models');
      return {
        success: true,
        models: response.data || {},
        message: '获取常用模型列表成功'
      };
    } catch (error) {
      console.error('获取常用模型列表失败:', error);
      return {
        success: false,
        error: '获取常用模型列表失败: ' + error.message,
        models: {}
      };
    }
  }

  /**
   * 添加模型到常用列表
   * @param {string} modelId - 模型ID
   * @param {string} provider - 提供商
   */
  async addFavoriteModel(modelId, provider) {
    try {
      const response = await httpClient.post('/api/provider/favorite-models', {
        modelId,
        provider
      });
      return {
        success: true,
        models: response.data || {},
        message: '添加常用模型成功'
      };
    } catch (error) {
      console.error('添加常用模型失败:', error);
      return {
        success: false,
        error: '添加常用模型失败: ' + error.message,
        models: {}
      };
    }
  }

  /**
   * 从常用列表中移除模型
   * @param {string} modelId - 模型ID
   */
  async removeFavoriteModel(modelId) {
    try {
      // 使用查询参数而不是路径参数来传递模型ID，避免斜杠导致的问题
      const response = await httpClient.delete('/api/provider/favorite-models', {
        params: { modelId }
      });
      return {
        success: true,
        models: response.data || {},
        message: '移除常用模型成功'
      };
    } catch (error) {
      console.error('移除常用模型失败:', error);
      return {
        success: false,
        error: '移除常用模型失败: ' + error.message,
        models: {}
      };
    }
  }

  /**
   * 删除自定义提供商
   * @param {string} providerId - 提供商ID
   */
  async deleteCustomProvider(providerId) {
    try {
      const response = await httpClient.delete(`/api/provider/custom-providers/${providerId}`);
      return {
        success: true,
        data: response.data || {},
        message: '删除提供商成功'
      };
    } catch (error) {
      console.error('删除提供商失败:', error);
      return {
        success: false,
        error: '删除提供商失败: ' + error.message,
        data: {}
      };
    }
  }

  /**
   * 添加自定义提供商
   * @param {string} name - 提供商名称
   * @param {string} baseUrl - API基础URL
   * @param {string} apiKey - API密钥
   */
  async addCustomProvider(name, baseUrl, apiKey) {
    try {
      const response = await httpClient.post('/api/provider/custom-providers', {
        name: name,
        baseUrl: baseUrl,
        apiKey: apiKey
      });
      return {
        success: response.success,
        message: response.message,
        data: response.data
      };
    } catch (error) {
      console.error('添加自定义提供商失败:', error);
      return {
        success: false,
        error: '添加自定义提供商失败: ' + error.message,
        data: {}
      };
    }
  }
}

// 创建全局提供商配置服务实例
const globalProviderService = new ProviderService();

export default globalProviderService;