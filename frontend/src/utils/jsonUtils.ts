/**
 * 尝试补全不完整的JSON字符串
 * 只考虑完成path，写content时的json结构补全
 * 前者不补全也不影响，只有一些不重要的报错
 * @param jsonStr - 不完整的JSON字符串
 * @returns 补全后的JSON字符串，如果无法补全则返回原字符串
 */
export const tryCompleteJSON = (jsonStr: string): string => {
  let result = jsonStr.trim();
  
  // 如果已经是完整的JSON，直接返回
  try {
    JSON.parse(result);
    return result;
  } catch (e) {
    // JSON不完整，尝试补全
  }
  
  // 尝试补全：添加引号和右大括号
  const testStr = result + '"}';
  try {
    JSON.parse(testStr);
    return testStr;
  } catch (e) {
    // 补全失败，尝试只添加右大括号
  }
  
  // 尝试补全：只添加右大括号
  const testStr2 = result + '}';
  try {
    JSON.parse(testStr2);
    return testStr2;
  } catch (e) {
    // 补全失败，返回原字符串
  }
  
  return result;
};
