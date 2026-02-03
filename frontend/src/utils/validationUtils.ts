/**
 * 验证分段大小 (0-1000)
 */
export const validateChunkSize = (value: string): string => {
  const num = parseInt(value);
  if (value === '' || isNaN(num)) return value;
  return Math.min(Math.max(num, 0), 1000).toString();
};

/**
 * 验证重叠大小 (小于分段大小)
 */
export const validateOverlapSize = (value: string, chunkSize: string): string => {
  const num = parseInt(value);
  const chunk = parseInt(chunkSize);
  if (value === '' || isNaN(num)) return value;
  const validated = Math.min(Math.max(num, 0), chunk - 1);
  return validated.toString();
};

/**
 * 验证相似度 (0-9的整数，前端显示用)
 */
export const validateSimilarity = (value: string): string => {
  const num = parseInt(value);
  if (value === '' || isNaN(num)) return value;
  return Math.min(Math.max(num, 0), 9).toString();
};

/**
 * 验证返回文档片段数 (0-50)
 */
export const validateReturnDocs = (value: string): string => {
  const num = parseInt(value);
  if (value === '' || isNaN(num)) return value;
  return Math.min(Math.max(num, 0), 50).toString();
};

/**
 * 将前端显示的相似度(0-9)转换为后端需要的相似度(0.0-0.9)
 */
export const convertSimilarityForBackend = (similarity: string): number => {
  return parseInt(similarity) / 10;
};

/**
 * 将后端返回的相似度(0.0-0.9)转换为前端显示的相似度(0-9)
 */
export const convertSimilarityForFrontend = (similarity: number): string => {
  return (similarity * 10).toString();
};
