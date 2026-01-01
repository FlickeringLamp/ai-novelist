// API 基础配置
const API_BASE_URL = 'http://localhost:8000';

// 通用的 fetch 封装函数
const api = {
  baseURL: API_BASE_URL,
  timeout: 30000, // 请求超时时间（30秒）
  
  // 解析响应的统一处理函数
  async parseResponse(response) {
    const data = await response.json();
    if (response.ok) {
      return {
        success: true,
        data: data.data,
        message: data.message,
        status: response.status,
        // 保留原始数据，以便某些接口直接使用
        sessions: data.sessions,
        checkpoints: data.checkpoints
      };
    }
    return {
      success: false,
      error: data.detail || data.error || data.message,
      status: response.status
    };
  },
  
  // GET 请求
  get: async (url, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    return await api.parseResponse(response);
  },
  
  // POST 请求
  post: async (url, data, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    });
    return await api.parseResponse(response);
  },
  
  // PUT 请求
  put: async (url, data, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    });
    return await api.parseResponse(response);
  },
  
  // DELETE 请求
  delete: async (url, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    return await api.parseResponse(response);
  }
};

export default api;