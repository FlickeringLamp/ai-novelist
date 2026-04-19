package launcher

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"launcher/internal/backend"
	"launcher/internal/env"
	"launcher/internal/frontend"
	"launcher/internal/migration"
)

type Logger interface {
	Logf(format string, args ...interface{})
	Progress(percent int)
}

// LaunchResult 保存启动后的进程信息
type LaunchResult struct {
	FrontendCmd *exec.Cmd
}

// LaunchAll 完成环境准备并启动前端（Electron 自管后端）
func LaunchAll(projectPath, pipMirror, npmMirror string, logger Logger) (*LaunchResult, error) {
	if !filepath.IsAbs(projectPath) {
		absPath, err := filepath.Abs(projectPath)
		if err != nil {
			return nil, fmt.Errorf("无法解析项目路径: %w", err)
		}
		projectPath = absPath
	}

	baseDir := filepath.Dir(projectPath)

	// 1. 检测/下载 Python
	logger.Logf("=== 检查 Python 环境 ===")
	pythonPath, ok := env.DetectPython(baseDir)
	if !ok {
		logger.Logf("未找到 Python，开始自动下载 ...")
		if err := env.DownloadPython(baseDir, logger); err != nil {
			return nil, fmt.Errorf("Python 下载失败: %w", err)
		}
		pythonPath, _ = env.DetectPython(baseDir)
		if pythonPath == "" {
			return nil, fmt.Errorf("安装 Python 后仍无法找到")
		}
	}
	logger.Logf("使用 Python: %s", pythonPath)

	// 2. 检测/下载 Node
	logger.Logf("=== 检查 Node.js 环境 ===")
	nodePath, ok := env.DetectNode(baseDir)
	if !ok {
		logger.Logf("未找到 Node.js，开始自动下载 ...")
		if err := env.DownloadNode(baseDir, logger); err != nil {
			return nil, fmt.Errorf("Node.js 下载失败: %w", err)
		}
		nodePath, _ = env.DetectNode(baseDir)
		if nodePath == "" {
			return nil, fmt.Errorf("安装 Node.js 后仍无法找到")
		}
	}
	logger.Logf("使用 Node.js: %s", nodePath)

	// 3. 检查项目目录
	if _, err := os.Stat(projectPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("项目目录不存在: %s，请先更新下载项目", projectPath)
	}

	// 4. 配置迁移
	logger.Logf("=== 检查配置迁移 ===")
	if err := migration.RunAll(projectPath); err != nil {
		return nil, fmt.Errorf("配置迁移失败: %w", err)
	}

	// 5. 后端环境：虚拟环境 + pip install（Electron 会自己启动后端）
	logger.Logf("=== 部署后端环境 ===")
	venvPython, err := backend.EnsureVenv(projectPath, pythonPath, logger)
	if err != nil {
		return nil, err
	}
	if err := backend.PipInstall(projectPath, venvPython, pipMirror, logger); err != nil {
		return nil, err
	}

	// 6. 前端：npm install + 启动（Electron 自管后端）
	logger.Logf("=== 部署前端 ===")
	if err := frontend.NpmInstall(projectPath, nodePath, npmMirror, logger); err != nil {
		return nil, err
	}
	frontendCmd, err := frontend.Start(projectPath, nodePath, logger)
	if err != nil {
		return nil, err
	}

	logger.Logf("=== 启动完成 ===")
	return &LaunchResult{
		FrontendCmd: frontendCmd,
	}, nil
}
