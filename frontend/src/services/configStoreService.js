// 配置存储服务 - 负责配置值的存储和获取
import httpClient from '../utils/httpClient.js';

class ConfigStoreService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 获取存储值
   * @param {string} key - 存储键名
   * @returns {Promise<any>} 存储值
   */
  async getStoreValue(key) {
    try {
      // 使用后端配置存储 API
      const response = await httpClient.get(`/api/config/store?key=${encodeURIComponent(key)}`);
      
      // 后端返回的是 APIResponse 格式，其中 data 字段包含实际的值
      return response.data;
    } catch (error) {
      console.error('获取存储值失败:', error);
      // 返回 null 而不是错误对象，保持与 IPC 版本的兼容性
      return null;
    }
  }

  /**
   * 设置存储值
   * @param {string} key - 存储键名
   * @param {any} value - 存储值
   * @returns {Promise<Object>} 设置结果
   */
  async setStoreValue(key, value) {
    try {
      console.log('发送到后端的请求数据:', { key, value });
      // 使用后端配置存储 API
      const response = await httpClient.post('/api/config/store', {
        key,
        value
      });
      return {
        success: true,
        message: '存储值设置成功'
      };
    } catch (error) {
      console.error('设置存储值失败:', error);
      console.error('错误详情:', error.details);
      return {
        success: false,
        error: '存储操作失败: ' + error.message
      };
    }
  }

  /**
   * 获取默认提示词
   * @returns {Promise<Object>} 提示词数据
   */
  async getDefaultPrompts() {
    try {
      const response = await httpClient.get('/api/ai-config/default-prompts');
      return {
        success: true,
        prompts: response.data || {},
        message: '默认提示词获取成功'
      };
    } catch (error) {
      console.error('获取默认提示词失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        prompts: {}
      };
    }
  }

  /**
   * 获取 API Key
   * @returns {Promise<Object>} API Key 数据
   */
  async getApiKey() {
    try {
      // 从本地存储获取 API Key
      const apiKey = localStorage.getItem('store_deepseekApiKey') || '';
      return {
        success: true,
        apiKey: apiKey ? JSON.parse(apiKey) : '',
        message: 'API Key 获取成功'
      };
    } catch (error) {
      console.error('获取 API Key 失败:', error);
      return {
        success: false,
        error: '获取 API Key 失败: ' + error.message,
        apiKey: ''
      };
    }
  }

}

// 创建全局配置存储服务实例
const configStoreService = new ConfigStoreService();

export default configStoreService;