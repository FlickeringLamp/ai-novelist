// API 基础配置
const API_BASE_URL = 'http://localhost:8000';

// 通用的 fetch 封装函数
const api = {
  baseURL: API_BASE_URL,
  timeout: 30000, // 请求超时时间（30秒）
  
  async parseResponse(response) {
    // 处理204 No Content响应
    if (response.status === 204) {
      return null;
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || '请求失败');
    }
    return data;
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