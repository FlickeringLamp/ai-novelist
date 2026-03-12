import { useDispatch } from 'react-redux';
import { setChapters } from '../store/file.ts';
import httpClient from './httpClient.ts';

/**
 * Hook 版本的文件树获取函数
 * 可以在组件中使用，用于刷新文件树列表
 */
export const useFetchFileTree = () => {
  const dispatch = useDispatch();

  const fetchAndSetFileTree = async () => {
    try {
      const result = await httpClient.get('/api/file/tree');
      dispatch(setChapters(result || []));
    } catch (error) {
      console.error('获取文件树失败：', error);
      throw error;
    }
  };

  return fetchAndSetFileTree;
};
