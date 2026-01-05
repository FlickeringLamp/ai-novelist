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
      // 处理FastAPI的验证错误（422错误）
      if (Array.isArray(data.detail)) {
        const errorMessages = data.detail.map(error => {
          const field = error.loc ? error.loc.join('.') : 'unknown';
          return `${field}: ${error.msg}`;
        }).join('; ');
        throw new Error(errorMessages || '请求参数验证失败');
      }
      // 处理其他类型的错误，优先使用 detail 字段
      throw new Error(data.detail || data.error || '请求失败');
    }
    return data;
  },
  
  // GET 请求
  get: async (url) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return await api.parseResponse(response);
  },
  
  // POST 请求
  post: async (url, data) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return await api.parseResponse(response);
  },
  
  // PUT 请求
  put: async (url, data) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return await api.parseResponse(response);
  },
  
  // DELETE 请求
  delete: async (url) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return await api.parseResponse(response);
  },
  
  // 上传文件请求
  upload: async (url, formData) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      // 不设置 Content-Type，让浏览器自动设置 multipart/form-data
      body: formData
    });
    return await api.parseResponse(response);
  }
};

export default api;