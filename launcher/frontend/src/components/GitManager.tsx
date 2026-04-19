import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import {
  setCommits,
  setBranches,
  setSelectedCommit,
  setGitLoading,
  setCheckoutLoading,
} from '../store/git';
import {
  GitHistory,
  GitBranches,
  GitCheckout,
  GitSwitchBranch,
} from '../../wailsjs/go/main/App';
import { Gitgraph, TemplateName } from '@gitgraph/react';

interface CommitDetail {
  sha: string;
  message: string;
  date: string;
  author: string;
  parents: string[];
  is_head: boolean;
}

interface BranchInfo {
  name: string;
  is_remote: boolean;
  is_current: boolean;
  sha: string;
}

export default function GitManager() {
  const dispatch = useDispatch();
  const {
    commits,
    branches,
    selectedCommit,
    currentBranch,
    loading,
    checkoutLoading,
  } = useSelector((state: RootState) => state.gitSlice);

  const [activeTab, setActiveTab] = useState<'commits' | 'graph'>('commits');

  const refresh = useCallback(async () => {
    dispatch(setGitLoading(true));
    try {
      const [c, b] = await Promise.all([
        GitHistory(50),
        GitBranches(),
      ]);
      dispatch(setCommits(c || []));
      dispatch(setBranches(b || []));
    } catch (e) {
      console.error(e);
    } finally {
      dispatch(setGitLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCheckout = async () => {
    if (!selectedCommit) return;
    dispatch(setCheckoutLoading(true));
    try {
      await GitCheckout(selectedCommit.sha);
      await refresh();
    } catch (e: any) {
      alert('切换版本失败: ' + (e?.message || e));
    } finally {
      dispatch(setCheckoutLoading(false));
    }
  };

  const handleSwitchBranch = async (name: string) => {
    dispatch(setCheckoutLoading(true));
    try {
      await GitSwitchBranch(name);
      await refresh();
    } catch (e: any) {
      alert('切换分支失败: ' + (e?.message || e));
    } finally {
      dispatch(setCheckoutLoading(false));
    }
  };

  const localBranches = branches.filter((b: BranchInfo) => !b.is_remote);

  return (
    <div className="git-manager">
      <div className="git-header">
        <h2>Git 存档管理</h2>
        <div className="git-actions">
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      <div className="git-branch-bar">
        <span className="git-label">当前分支:</span>
        <select
          className="git-select"
          value={currentBranch}
          onChange={(e) => handleSwitchBranch(e.target.value)}
          disabled={checkoutLoading}
        >
          {localBranches.map((b: BranchInfo) => (
            <option key={b.name} value={b.name}>
              {b.name} {b.is_current ? '(当前)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="git-tabs">
        <button
          className={`git-tab ${activeTab === 'commits' ? 'active' : ''}`}
          onClick={() => setActiveTab('commits')}
        >
          Commit 列表
        </button>
        <button
          className={`git-tab ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          分支图
        </button>
      </div>

      <div className="git-content">
        {activeTab === 'commits' ? (
          <div className="git-commits">
            {commits.length === 0 && !loading && (
              <div className="git-empty">暂无提交记录（可能是浅克隆仓库，只保留了最新提交）</div>
            )}
            {commits.map((c: CommitDetail) => (
              <div
                key={c.sha}
                className={`git-commit-item ${selectedCommit?.sha === c.sha ? 'selected' : ''} ${c.is_head ? 'head' : ''}`}
                onClick={() => dispatch(setSelectedCommit(c))}
              >
                <div className="git-commit-top">
                  <span className="git-commit-sha">{c.sha.slice(0, 7)}</span>
                  <span className="git-commit-date">{formatDate(c.date)}</span>
                  {c.is_head && <span className="git-commit-head-badge">HEAD</span>}
                </div>
                <div className="git-commit-msg">{c.message}</div>
                <div className="git-commit-author">{c.author}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="git-graph-panel">
            <GitGraphView commits={commits} branchName={currentBranch || 'main'} />
          </div>
        )}
      </div>

      {selectedCommit && (
        <div className="git-commit-action-bar">
          <span className="git-selected-info">
            选中: <code>{selectedCommit.sha.slice(0, 7)}</code> {selectedCommit.message.split('\n')[0]}
          </span>
          <div className="git-action-btns">
            <button
              className="btn warn"
              onClick={handleCheckout}
              disabled={checkoutLoading || selectedCommit.is_head}
            >
              {selectedCommit.is_head ? '当前版本' : checkoutLoading ? '切换中...' : '切换到该版本'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 使用 @gitgraph/react 渲染分支图
function GitGraphView({ commits, branchName }: { commits: CommitDetail[]; branchName: string }) {
  if (commits.length === 0) {
    return <div className="git-empty">暂无数据</div>;
  }

  const reversed = [...commits].reverse();

  return (
    <Gitgraph options={{ template: TemplateName.Metro }}>
      {(gitgraph: any) => {
        const main = gitgraph.branch(branchName);
        reversed.forEach((c) => {
          main.commit({
            subject: c.message.split('\n')[0],
            hash: c.sha.slice(0, 7),
            author: c.author,
          });
        });
        return null;
      }}
    </Gitgraph>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return d.toLocaleDateString('zh-CN');
}
