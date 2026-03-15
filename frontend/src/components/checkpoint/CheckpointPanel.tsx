import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faPlus, faHistory, faFile, faChevronDown, faChevronRight, faUndo } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../utils/httpClient';
import { createTempDiffTab } from '../../store/editor.ts';
import UnifiedModal from '../others/UnifiedModal';

interface Checkpoint {
  commit_hash: string;
  short_hash: string;
  message: string;
}

interface FileChange {
  path: string;
  change_type: string;  // 'M'=修改, 'A'=新增, 'D'=删除
  old_content?: string;
  new_content?: string;
}

interface GitStatus {
  branch: string;
  dirty: boolean;
  untracked_files: string[];
  modified_files: string[];
}

interface CheckpointPanelProps {
  onDiffDisplay?: (diff: string, filePath: string) => void;
}

const CheckpointPanel = ({ onDiffDisplay }: CheckpointPanelProps) => {
  const dispatch = useDispatch();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedCheckpoint, setExpandedCheckpoint] = useState<string | null>(null);
  const [checkpointChanges, setCheckpointChanges] = useState<FileChange[]>([]);
  const [checkpointChangesMap, setCheckpointChangesMap] = useState<Record<string, any>>({});
  const [showStagedFiles, setShowStagedFiles] = useState(false);
  const [restoreModal, setRestoreModal] = useState<{ show: boolean; checkpoint: Checkpoint | null }>({ show: false, checkpoint: null });
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

  const handleExpandCheckpoint = async (checkpoint: Checkpoint) => {
    if (expandedCheckpoint === checkpoint.commit_hash) {
      setExpandedCheckpoint(null);
      setCheckpointChanges([]);
      setCheckpointChangesMap({});
    } else {
      setExpandedCheckpoint(checkpoint.commit_hash);
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
          
          // 使用 Redux 创建差异对比标签
          dispatch(createTempDiffTab({
            id: filePath,
            originalContent,
            modifiedContent
          }));
        } else {
          console.warn('未找到文件的变更信息:', filePath);
        }
      } else {
        // 获取当前工作区与HEAD的差异（暂不处理，如需要可添加逻辑）
        console.warn('当前工作区差异暂未实现');
      }
    } catch (error) {
      console.error('获取文件差异失败:', error);
    }
  };

  const getChangeTypeIcon = (change: FileChange) => {
    if (change.change_type === 'A') return <FontAwesomeIcon icon={faFile} className="text-green-500" />;
    if (change.change_type === 'D') return <FontAwesomeIcon icon={faFile} className="text-red-500" />;
    if (change.change_type === 'M') return <FontAwesomeIcon icon={faFile} className="text-yellow-500" />;
    return <FontAwesomeIcon icon={faFile} className="text-theme-gray4" />;
  };

  const handleRestoreCheckpoint = async (checkpoint: Checkpoint) => {
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
    <div className="w-full h-full bg-theme-black flex flex-col overflow-hidden">
      {/* 保存存档点区域 */}
      <div className="p-4 border-b border-theme-gray3">
        <div className="flex items-center gap-2 mb-2">
          <FontAwesomeIcon icon={faSave} className="text-theme-green" />
          <h2 className="text-sm font-semibold text-theme-white">保存存档点</h2>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入存档点消息..."
            className="flex-1 bg-theme-gray2 border border-theme-gray3 rounded px-3 py-2 text-sm text-theme-white placeholder-theme-gray4 focus:outline-none focus:border-theme-green"
            disabled={loading}
          />
          <button
            onClick={handleSaveCheckpoint}
            disabled={loading}
            className="px-4 py-2 bg-theme-green text-black rounded text-sm font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 当前状态区域 */}
      <div className="flex-1 overflow-y-auto">
        {/* 更改文件 */}
        <div className="border-b border-theme-gray3">
          <div
            className="p-3 flex items-center gap-2 cursor-pointer hover:bg-theme-gray2 transition-colors"
            onClick={() => setShowStagedFiles(!showStagedFiles)}
          >
            <FontAwesomeIcon
              icon={showStagedFiles ? faChevronDown : faChevronRight}
              className="text-theme-gray4 text-xs"
            />
            <FontAwesomeIcon icon={faHistory} className="text-theme-green" />
            <span className="text-sm text-theme-white font-semibold">当前更改</span>
          </div>

          {showStagedFiles && status && (
            <div className="px-3 pb-3">
              {/* 修改的文件 */}
              {status.modified_files && status.modified_files.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-theme-gray4 mb-1">修改的文件:</p>
                  {status.modified_files.map((file, index) => (
                    <div
                      key={`modified-${index}`}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-theme-gray2 rounded cursor-pointer transition-colors"
                      onClick={() => handleShowFileDiff(file)}
                    >
                      <FontAwesomeIcon icon={faFile} className="text-yellow-500 text-xs" />
                      <span className="text-xs text-theme-white truncate">{file}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 未跟踪的文件 */}
              {status.untracked_files && status.untracked_files.length > 0 && (
                <div>
                  <p className="text-xs text-theme-gray4 mb-1">未跟踪的文件:</p>
                  {status.untracked_files.map((file, index) => (
                    <div
                      key={`untracked-${index}`}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-theme-gray2 rounded transition-colors"
                    >
                      <FontAwesomeIcon icon={faFile} className="text-green-500 text-xs" />
                      <span className="text-xs text-theme-white truncate">{file}</span>
                    </div>
                  ))}
                </div>
              )}

              {(!status.modified_files || status.modified_files.length === 0) &&
               (!status.untracked_files || status.untracked_files.length === 0) && (
                <p className="text-xs text-theme-gray4">没有更改</p>
              )}
            </div>
          )}
        </div>

        {/* 存档点历史 */}
        <div className="flex-1">
          <div className="p-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faHistory} className="text-theme-green" />
            <h3 className="text-sm font-semibold text-theme-white">存档点历史</h3>
          </div>

          {checkpoints.length === 0 ? (
            <div className="px-3 pb-3">
              <p className="text-xs text-theme-gray4">暂无存档点</p>
            </div>
          ) : (
            <div className="px-3 pb-3">
              {checkpoints.map((checkpoint) => (
                <div key={checkpoint.commit_hash} className="mb-2">
                  <div className="flex items-center justify-between p-2 bg-theme-gray2 rounded hover:bg-theme-gray3 transition-colors">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={expandedCheckpoint === checkpoint.commit_hash ? faChevronDown : faChevronRight}
                        className="text-theme-gray4 text-xs cursor-pointer"
                        onClick={() => handleExpandCheckpoint(checkpoint)}
                      />
                      <span className="text-xs font-mono text-theme-green">{checkpoint.short_hash}</span>
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
                  {expandedCheckpoint === checkpoint.commit_hash && checkpointChanges.length > 0 && (
                    <div className="mt-2 ml-4 border-l-2 border-theme-gray3 pl-2">
                      {checkpointChanges.map((change, index) => {
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
                      })}
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
              className: 'bg-gray-600'
            },
            {
              text: restoring ? '恢复中...' : '确认恢复',
              onClick: confirmRestore,
              className: 'bg-blue-600',
            }
          ]}
        />
      )}
    </div>
  );
};

export default CheckpointPanel;
