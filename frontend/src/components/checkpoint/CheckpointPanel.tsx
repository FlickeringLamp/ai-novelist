import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faPlus, faHistory, faFile, faUndo, faChevronRight, faChevronDown} from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../utils/httpClient';
import { setCheckpointPreview } from '../../store/editor.ts';
import UnifiedModal from '../others/UnifiedModal';
import type { CheckpointPanelProps, ApiCheckpoint, ApiFileChange, ApiGitChange, ApiGitStatus } from '@/types';

const CheckpointPanel = ({ onDiffDisplay }: CheckpointPanelProps) => {
  const dispatch = useDispatch();
  const [status, setStatus] = useState<ApiGitStatus | null>(null);
  const [checkpoints, setCheckpoints] = useState<ApiCheckpoint[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedCheckpoint, setExpandedCheckpoint] = useState<string | null>(null);
  const [checkpointChanges, setCheckpointChanges] = useState<ApiFileChange[]>([]);
  const [checkpointChangesMap, setCheckpointChangesMap] = useState<Record<string, any>>({});
  const [loadingChanges, setLoadingChanges] = useState(false);

  const [restoreModal, setRestoreModal] = useState<{ show: boolean; checkpoint: ApiCheckpoint | null }>({ show: false, checkpoint: null });
  const [restoring, setRestoring] = useState(false);

  // 获取Git状态
  useEffect(() => {
    fetchStatus();
  }, []);

  // 获取所有存档点
  useEffect(() => {
    fetchCheckpoints();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await httpClient.get('/api/checkpoints/status');
      setStatus(response);
    } catch (error) {
      console.error('获取状态失败:', error);
    }
  };

  const fetchCheckpoints = async () => {
    try {
      const response = await httpClient.get('/api/checkpoints/list');
      setCheckpoints(response.checkpoints || []);
    } catch (error) {
      console.error('获取存档点列表失败:', error);
    }
  };

  const handleSaveCheckpoint = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await httpClient.post('/api/checkpoints/save', {
        message: message || undefined
      });

      if (response.success) {
        setMessage('');
        await fetchStatus();
        await fetchCheckpoints();
      }
    } catch (error) {
      console.error('保存存档点失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExpandCheckpoint = async (checkpoint: ApiCheckpoint) => {
    if (expandedCheckpoint === checkpoint.commit_hash) {
      setExpandedCheckpoint(null);
      setCheckpointChanges([]);
      setCheckpointChangesMap({});
    } else {
      setExpandedCheckpoint(checkpoint.commit_hash);
      // 清空旧文件列表，等待新状态加载
      setCheckpointChanges([]);
      setCheckpointChangesMap({});
      setLoadingChanges(true);
      try {
        const response = await httpClient.get(`/api/checkpoints/diff/${checkpoint.commit_hash}`);
        if (response.success) {
          // 对于初始提交，创建特殊标记
          if (response.is_initial_commit) {
            setCheckpointChanges([{
              path: '<初始提交>',
              change_type: 'INIT',
            } as any]);
            setCheckpointChangesMap({});
          } else {
            setCheckpointChanges(response.changes || []);
            // 构建文件路径到变更数据的映射
            const changesMap: Record<string, any> = {};
            (response.changes || []).forEach((change: any) => {
              changesMap[change.path] = change;
            });
            setCheckpointChangesMap(changesMap);
          }
        }
      } catch (error) {
        console.error('获取存档点差异失败:', error);
      } finally {
        setLoadingChanges(false);
      }
    }
  };

  const handleShowFileDiff = async (filePath: string, commitHash?: string) => {
    try {
      if (commitHash) {
        // 从已获取的 checkpointChangesMap 中提取文件变更数据
        const change = checkpointChangesMap[filePath];
        if (change) {
          const originalContent = change.old_content || '';
          const modifiedContent = change.new_content || '';
          
          // 使用 Redux 创建存档点预览标签
          dispatch(setCheckpointPreview({
            id: filePath,
            checkpointContent: originalContent,
            currentContent: modifiedContent
          }));
        } else {
          console.warn('未找到文件的变更信息:', filePath);
        }
      } else {
        // 获取当前工作区与最新提交之间的差异
        const response = await httpClient.get(`/api/checkpoints/working-diff/${filePath}`);
        if (response.success) {
          dispatch(setCheckpointPreview({
            id: filePath,
            checkpointContent: response.old_content || '',
            currentContent: response.new_content || ''
          }));
        } else {
          console.warn('获取工作区差异失败:', response.message);
        }
      }
    } catch (error) {
      console.error('获取文件差异失败:', error);
    }
  };

  const getChangeTypeIcon = (change: ApiFileChange | ApiGitChange) => {
    if (change.change_type === 'A') return <FontAwesomeIcon icon={faFile} className="text-theme-green text-xs" />;
    if (change.change_type === 'D') return <FontAwesomeIcon icon={faFile} className="text-theme-red text-xs" />;
    if (change.change_type === 'M') return <FontAwesomeIcon icon={faFile} className="text-theme-yellow text-xs" />;
    return <FontAwesomeIcon icon={faFile} className="text-theme-gray4 text-xs" />;
  };

  const handleRestoreCheckpoint = async (checkpoint: ApiCheckpoint) => {
    setRestoreModal({ show: true, checkpoint });
  };

  const confirmRestore = async () => {
    if (!restoreModal.checkpoint) return;

    setRestoring(true);
    try {
      const response = await httpClient.post('/api/checkpoints/restore', {
        commit_hash: restoreModal.checkpoint.commit_hash
      });

      if (response.success) {
        await fetchStatus();
        await fetchCheckpoints();
        setExpandedCheckpoint(null);
        setCheckpointChanges([]);
        setCheckpointChangesMap({});
      }
    } catch (error) {
      console.error('恢复存档点失败:', error);
    } finally {
      setRestoring(false);
      setRestoreModal({ show: false, checkpoint: null });
    }
  };

  const cancelRestore = () => {
    setRestoreModal({ show: false, checkpoint: null });
  };

  return (
    <div className="w-full h-full bg-theme-black overflow-hidden">
      {/* 保存存档点区域 */}
      <div className="h-[40%] flex flex-col p-1 border-b border-theme-gray3 overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold text-theme-white">当前更改</h2>
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="保存消息"
            className="w-full bg-theme-gray2 border border-theme-gray3 text-sm px-2 py-1 rounded"
            disabled={loading}
          />
          <button
            onClick={handleSaveCheckpoint}
            disabled={loading}
            className="w-full bg-theme-green text-black rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors py-1"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
        {/* 更改文件 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="pb-1 border-b border-theme-gray3 flex items-center gap-2">
            <FontAwesomeIcon icon={faHistory} className="text-theme-green" />
            <span className="text-sm text-theme-white font-semibold">当前更改</span>
          </div>

          {status && (
            <div className="flex-1 overflow-y-auto">
              {/* 所有变更文件 */}
              {(() => {
                // 将未跟踪文件转换为 GitChange 对象
                const untrackedChanges: ApiGitChange[] = (status.untracked_files || []).map((file: string) => ({
                  path: file,
                  change_type: 'A'
                }));
                // 合并所有变更并按路径排序
                const allChanges = [...(status.changes || []), ...untrackedChanges].sort((a, b) =>
                  a.path.localeCompare(b.path)
                );

                if (allChanges.length === 0) {
                  return <p className="text-xs text-theme-gray4">没有更改</p>;
                }

                return allChanges.map((change, index) => (
                  <div
                    key={`change-${index}`}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-theme-gray2 rounded cursor-pointer transition-colors"
                    onClick={() => handleShowFileDiff(change.path)}
                  >
                    {getChangeTypeIcon(change)}
                    <span className="text-xs text-theme-white truncate">{change.path}</span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>

      {/* 当前状态区域 */}
      <div className="h-[60%] overflow-y-auto">
        {/* 存档点历史 */}
        <div className="flex-1">
          <div className="pb-1 border-b border-theme-gray3 flex items-center gap-2">
            <FontAwesomeIcon icon={faHistory} className="text-theme-green" />
            <h3 className="text-sm font-semibold text-theme-white">存档点历史</h3>
          </div>

          {checkpoints.length === 0 ? (
            <div className="px-3 pb-3">
              <p className="text-xs text-theme-gray4">暂无存档点</p>
            </div>
          ) : (
            <div className="w-full">
              {checkpoints.map((checkpoint) => (
                <div key={checkpoint.commit_hash} className="mb-2">
                  <div className="w-full flex items-center justify-between p-2 bg-theme-gray2 rounded hover:bg-theme-gray3 overflow-hidden cursor-pointer">
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1"
                      onClick={() => handleExpandCheckpoint(checkpoint)}
                      >
                      <FontAwesomeIcon
                        icon={expandedCheckpoint === checkpoint.commit_hash ? faChevronDown : faChevronRight}
                        className="flex-shrink-0"
                      />
                      <span className="text-xs text-theme-green">{checkpoint.short_hash}</span>
                      <span className="text-xs text-theme-white truncate">{checkpoint.message}</span>
                    </div>
                    <button
                      onClick={() => handleRestoreCheckpoint(checkpoint)}
                      className="text-theme-white rounded text-xs font-semibold transition-colors hover:text-theme-green"
                    >
                      <FontAwesomeIcon icon={faUndo} className="mr-1" />
                    </button>
                  </div>

                  {/* 展开的文件更改列表 */}
                  {expandedCheckpoint === checkpoint.commit_hash && (
                    <div className="mt-2 ml-4 border-l-2 border-theme-gray3 pl-2">
                      {loadingChanges ? (
                        <div className="flex items-center gap-2 px-2 py-1 text-theme-gray4">
                          <span className="text-xs">加载中...</span>
                        </div>
                      ) : checkpointChanges.length > 0 ? (
                        checkpointChanges.map((change, index) => {
                          const isInitialCommit = change.change_type === 'INIT';
                          return (
                            <div
                              key={`change-${index}`}
                              className={`flex items-center gap-2 px-2 py-1 hover:bg-theme-gray2 rounded transition-colors ${!isInitialCommit ? 'cursor-pointer' : ''}`}
                              onClick={() => !isInitialCommit && handleShowFileDiff(change.path, expandedCheckpoint || undefined)}
                            >
                              {getChangeTypeIcon(change)}
                              {isInitialCommit ? (
                                <span className="text-xs text-theme-gray4 italic">{change.path}</span>
                              ) : (
                                <span className="text-xs text-theme-white truncate">{change.path}</span>
                              )}
                            </div>
                          );
                        })
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 恢复确认模态框 */}
      {restoreModal.show && restoreModal.checkpoint && (
        <UnifiedModal
          title="确认恢复"
          message={`确定要将工作区恢复到存档点 "${restoreModal.checkpoint.message}" (${restoreModal.checkpoint.short_hash}) 吗？此操作将覆盖当前工作区的所有未保存更改。`}
          buttons={[
            {
              text: '取消',
              onClick: cancelRestore,
              className: 'bg-theme-gray3'
            },
            {
              text: restoring ? '恢复中...' : '确认',
              onClick: confirmRestore,
              className: 'bg-theme-green',
            }
          ]}
        />
      )}
    </div>
  );
};

export default CheckpointPanel;
