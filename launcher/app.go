package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"launcher/internal/gitman"
	"launcher/internal/launcher"
	"launcher/internal/updater"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx         context.Context
	config      *updater.Config // 这里的星号表示，config不是一个完整的Config对象，而是指向Config的内存地址
	logBuffer   []string
	logMutex    sync.RWMutex
	cmdFrontend *os.Process
	cmdMutex    sync.Mutex
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) LoadConfig() (*updater.Config, error) {
	config, err := updater.LoadConfig()
	if err != nil {
		return nil, err
	}
	a.config = config
	return config, nil
}

func (a *App) GetVersion() string {
	if a.config == nil {
		return ""
	}
	projectPath := a.getProjectPath()
	local, err := updater.GetLocalCommit(projectPath)
	if err != nil {
		return "未安装"
	}
	if len(local.SHA) > 7 {
		return local.SHA[:7]
	}
	return local.SHA
}

func (a *App) CheckUpdate() (*updater.UpdateStatus, error) {
	if a.config == nil {
		return nil, fmt.Errorf("配置未加载")
	}
	return updater.CheckUpdateStatus(a.config)
}

func (a *App) PerformUpdate() error {
	if a.config == nil {
		return fmt.Errorf("配置未加载")
	}
	return updater.CloneOrPull(a.config, a)
}

func (a *App) getProjectPath() string {
	exePath, err := os.Executable()
	if err != nil {
		return filepath.Join(".", a.config.Git.ProjectDir)
	}
	return filepath.Join(filepath.Dir(exePath), a.config.Git.ProjectDir)
}

func (a *App) LaunchMainProgram() error {
	if a.config == nil {
		return fmt.Errorf("配置未加载")
	}

	a.cmdMutex.Lock()
	defer a.cmdMutex.Unlock()
	if a.cmdFrontend != nil {
		return fmt.Errorf("主程序已在运行中")
	}

	projectPath := a.getProjectPath()
	pipMirror := updater.PipMirrors[a.config.Mirror]
	npmMirror := updater.NpmMirrors[a.config.Mirror]

	go func() {
		result, err := launcher.LaunchAll(projectPath, pipMirror, npmMirror, a)
		if err != nil {
			a.Logf("启动失败: %v", err)
			a.emitMainProgramState(false)
			return
		}

		a.cmdMutex.Lock()
		a.cmdFrontend = result.FrontendCmd.Process
		a.cmdMutex.Unlock()

		a.emitMainProgramState(true)

		result.FrontendCmd.Wait()

		a.cmdMutex.Lock()
		a.cmdFrontend = nil
		a.cmdMutex.Unlock()
		a.emitMainProgramState(false)
	}()

	return nil
}

func (a *App) IsMainProgramRunning() bool {
	a.cmdMutex.Lock()
	defer a.cmdMutex.Unlock()
	return a.cmdFrontend != nil
}

func (a *App) emitMainProgramState(running bool) {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "main-program-state", running)
	}
}

func (a *App) KillMainProgram() error {
	a.cmdMutex.Lock()
	defer a.cmdMutex.Unlock()

	if a.cmdFrontend != nil {
		a.cmdFrontend.Kill()
		a.cmdFrontend = nil
	}
	return nil
}

func (a *App) GetLogs() string {
	a.logMutex.RLock()
	defer a.logMutex.RUnlock()
	var result string
	for _, line := range a.logBuffer {
		result += line
	}
	return result
}

func (a *App) Logf(format string, args ...interface{}) {
	line := fmt.Sprintf(format, args...)
	if len(line) == 0 || line[len(line)-1] != '\n' {
		line += "\n"
	}

	a.logMutex.Lock()
	a.logBuffer = append(a.logBuffer, line)
	a.logMutex.Unlock()

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "log", line)
	}
}

func (a *App) Progress(percent int) {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "progress", percent)
	}
}

func (a *App) AutoCheckUpdate() {
	go func() {
		time.Sleep(500 * time.Millisecond)
		a.Logf("=== %s 启动器 ===", a.config.App.Name)

		status, err := updater.CheckUpdateStatus(a.config)
		if err != nil {
			a.Logf("检查更新失败: %v", err)
			return
		}
		if status.HasUpdate {
			a.Logf("发现新提交: %s", status.RemoteCommit.SHA[:7])
			a.Logf("提交时间: %s", status.RemoteCommit.Date)
			a.Logf("提交信息:")
			for _, line := range strings.Split(status.RemoteCommit.Message, "\n") {
				line = strings.TrimSpace(line)
				if line != "" {
					a.Logf("  %s", line)
				}
			}
		} else {
			a.Logf("当前已是最新提交")
		}
	}()
}

func (a *App) GitHistory(limit int) ([]gitman.CommitDetail, error) {
	projectPath := a.getProjectPath()
	return gitman.GetCommitHistory(projectPath, limit)
}

func (a *App) GitBranches() ([]gitman.BranchInfo, error) {
	projectPath := a.getProjectPath()
	return gitman.GetBranches(projectPath)
}

func (a *App) GitCheckout(hash string) error {
	projectPath := a.getProjectPath()
	return gitman.CheckoutCommit(projectPath, hash)
}

func (a *App) GitSwitchBranch(name string) error {
	projectPath := a.getProjectPath()
	return gitman.SwitchBranch(projectPath, name)
}

func (a *App) GitCreateBranch(name string) error {
	projectPath := a.getProjectPath()
	return gitman.CreateBranch(projectPath, name)
}

func (a *App) SetMirror(mirror string) error {
	if a.config == nil {
		return fmt.Errorf("配置未加载")
	}
	if _, ok := updater.PipMirrors[mirror]; !ok {
		return fmt.Errorf("不支持的镜像源: %s", mirror)
	}
	a.config.Mirror = mirror
	return updater.SaveConfig(a.config)
}

func (a *App) GetMirror() string {
	if a.config == nil {
		return "tsinghua"
	}
	return a.config.Mirror
}
