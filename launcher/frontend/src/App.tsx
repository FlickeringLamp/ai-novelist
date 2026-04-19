import { useEffect, useRef, useState } from 'react';
import './App.css';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from './store/store';
import {
  addLog,
  setCopied,
  setMainRunning,
  setProgress,
  setUpdateStatus,
  setUpdating,
  setVersion,
  setLaunching,
  setLaunchPhase,
  setMirror,
  resetProgress,
} from './store/launcher';
import { useTheme } from './context/ThemeContext';
import {
  CheckUpdate,
  GetLogs,
  GetMirror,
  GetVersion,
  IsMainProgramRunning,
  LaunchMainProgram,
  LoadConfig,
  PerformUpdate,
  SetMirror,
} from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime';
import GitManager from './components/GitManager';

function App() {
  const dispatch = useDispatch();
  const {
    logs,
    version,
    updateStatus,
    updating,
    progress,
    copied,
    mainRunning,
    launching,
    launchPhase,
    mirror,
  } = useSelector((state: RootState) => state.launcherSlice);

  const { theme } = useTheme();
  const logRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'launcher' | 'git'>('launcher');

  const refreshStatus = async () => {
    try {
      const status = await CheckUpdate();
      dispatch(setUpdateStatus(status));
      const v = await GetVersion();
      dispatch(setVersion(v));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    LoadConfig().then(() => {
      refreshStatus();
      IsMainProgramRunning().then((running: boolean) => dispatch(setMainRunning(running)));
      GetMirror().then((m: string) => dispatch(setMirror(m)));
    });

    const offLog = EventsOn('log', (data: string) => {
      dispatch(addLog(data));
    });

    const offProgress = EventsOn('progress', (p: number) => {
      dispatch(setProgress(p));
    });

    const offMainState = EventsOn('main-program-state', (running: boolean) => {
      dispatch(setMainRunning(running));
      if (!running) {
        dispatch(setLaunching(false));
        dispatch(setLaunchPhase(''));
      }
    });

    return () => {
      offLog?.();
      offProgress?.();
      offMainState?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleUpdate = async () => {
    if (!updateStatus?.has_update) return;
    dispatch(setUpdating(true));
    try {
      await PerformUpdate();
      await refreshStatus();
      dispatch(resetProgress());
    } catch {
      dispatch(resetProgress());
    } finally {
      dispatch(setUpdating(false));
    }
  };

  const handleLaunch = async () => {
    dispatch(setLaunching(true));
    dispatch(setLaunchPhase('准备启动...'));
    try {
      await LaunchMainProgram();
    } catch {
      dispatch(setLaunching(false));
      dispatch(setLaunchPhase(''));
    }
  };

  const handleSetMirror = async (m: string) => {
    try {
      await SetMirror(m);
      dispatch(setMirror(m));
    } catch {
      // ignore
    }
  };

  const handleCopyLogs = async () => {
    const text = await GetLogs();
    await navigator.clipboard.writeText(text);
    dispatch(setCopied(true));
    setTimeout(() => dispatch(setCopied(false)), 1500);
  };

  const hasUpdate = updateStatus?.has_update ?? false;
  const remoteMsg = updateStatus?.remote_commit?.message ?? '';
  const remoteSha = updateStatus?.remote_commit?.sha ?? '';
  const localSha = updateStatus?.local_commit?.sha ?? '';

  return (
    <div className="app" style={{ background: theme.black, color: theme.white }}>
      <header className="header">
        <h1>青烛启动器</h1>
        <div className="header-right">
          <div className="tabs">
            <button
              className={`tab-btn ${tab === 'launcher' ? 'active' : ''}`}
              onClick={() => setTab('launcher')}
            >
              启动器
            </button>
            <button
              className={`tab-btn ${tab === 'git' ? 'active' : ''}`}
              onClick={() => setTab('git')}
            >
              Git管理
            </button>
          </div>
          <div className="meta">
            <span className="version">本地版本: {version || '-'}</span>
          </div>
        </div>
      </header>

      <main className="main">
        {tab === 'launcher' ? (
          <>

        <div className="toolbar">
          <button
            className="btn warn"
            onClick={handleUpdate}
            disabled={!hasUpdate || updating || launching}
            title={!hasUpdate ? '当前已是最新提交' : ''}
          >
            {updating ? '更新中...' : hasUpdate ? '立即更新' : '已是最新提交'}
          </button>
          <button
            className="btn primary"
            onClick={handleLaunch}
            disabled={mainRunning || launching}
            title={mainRunning ? '主程序正在运行中' : ''}
          >
            {mainRunning ? '运行中' : launching ? '启动中...' : '启动程序'}
          </button>
          <button
            className={`btn ${copied ? 'success' : ''}`}
            onClick={handleCopyLogs}
            disabled={copied}
          >
            {copied ? '复制成功' : '复制日志'}
          </button>
          <select
            className="btn"
            value={mirror}
            onChange={(e) => handleSetMirror(e.target.value)}
            title="选择镜像源"
          >
            <option value="tsinghua">清华源</option>
            <option value="aliyun">阿里源</option>
          </select>
        </div>

        {launching && (
          <div className="launch-phase" style={{ color: theme.accent }}>
            {launchPhase}
          </div>
        )}

        {hasUpdate && (
          <div className="update-info">
            <div className="commit-row">
              <span className="commit-label">远程提交:</span>
              <span className="commit-sha">{remoteSha.slice(0, 7)}</span>
            </div>
            <div className="commit-msg">{remoteMsg}</div>
            {localSha && (
              <div className="commit-row">
                <span className="commit-label">本地提交:</span>
                <span className="commit-sha">{localSha.slice(0, 7)}</span>
              </div>
            )}
          </div>
        )}

        {progress > 0 && progress < 100 && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <span className="progress-text">{progress}%</span>
          </div>
        )}

        <div className="log-box" ref={logRef}>
          {logs.length === 0 && (
            <div className="log-placeholder">等待日志输出...</div>
          )}
          {logs.map((line, idx) => (
            <div key={idx} className="log-line">
              <span className="log-prefix">{'>'}</span>
              <span className="log-content">{line.replace(/\n$/, '')}</span>
            </div>
          ))}
        </div>
          </>
        ) : (
          <GitManager />
        )}
      </main>
    </div>
  );
}

export default App;
