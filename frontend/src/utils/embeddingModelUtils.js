// 判断是否为嵌入模型
export const isEmbeddingModel = (modelName) => {
  if (!modelName) {
    return false;
  }

  // 重排序模型的关键词 - 需要排除的模型
  const rerankKeywords = ['rerank', 'reranker'];

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
  
  // 如果包含重排序关键词，则不是嵌入模型
  if (rerankKeywords.some(keyword => lowerModelName.includes(keyword))) {
    return false;
  }

  // 检查模型名称是否包含嵌入模型的关键词
  return embeddingKeywords.some(keyword => lowerModelName.includes(keyword));
};

// 过滤嵌入模型
export const filterEmbeddingModels = (models) => {
  if (!Array.isArray(models)) {
    console.warn('filterEmbeddingModels: 输入不是数组', models);
    return [];
  }
  return models.filter(model => {
    const modelName = model.id || '';
    const isEmbedding = isEmbeddingModel(modelName);    
    return isEmbedding;
  });
};
