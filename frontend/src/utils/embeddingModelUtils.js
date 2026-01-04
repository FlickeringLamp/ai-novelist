// 判断是否为嵌入模型
export const isEmbeddingModel = (modelName) => {
  if (!modelName) {
    return false;
  }

  // 嵌入模型的关键词
  const embeddingKeywords = [
    'embedding',
    'embed',
    'text-embedding',
    'bge-',
    'e5-',
    'sentence-transformers',
    'qwen3-embedding'
  ];

  const lowerModelName = modelName.toLowerCase();
  
  // 检查模型名称是否包含嵌入模型的关键词
  return embeddingKeywords.some(keyword => lowerModelName.includes(keyword));
};

// 判断是否为重排序模型
export const isRerankModel = (modelName) => {
  if (!modelName) {
    return false;
  }

  // 重排序模型的关键词
  const rerankKeywords = ['rerank', 'reranker'];

  const lowerModelName = modelName.toLowerCase();
  
  // 检查模型名称是否包含重排序模型的关键词
  return rerankKeywords.some(keyword => lowerModelName.includes(keyword));
};

// 过滤嵌入模型
export const filterEmbeddingModels = (models) => {
  if (!Array.isArray(models)) {
    console.warn('filterEmbeddingModels: 输入不是数组', models);
    return [];
  }
  return models.filter(model => {
    const modelName = model.id || '';
    return isEmbeddingModel(modelName);
  });
};

// 过滤重排序模型
export const filterRerankModels = (models) => {
  if (!Array.isArray(models)) {
    console.warn('filterRerankModels: 输入不是数组', models);
    return [];
  }
  return models.filter(model => {
    const modelName = model.id || '';
    return isRerankModel(modelName);
  });
};
