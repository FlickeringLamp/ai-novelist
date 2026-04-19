package frontend

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type Logger interface {
	Logf(format string, args ...interface{})
}

func NpmInstall(projectPath, nodePath, mirrorURL string, logger Logger) error {
	frontendPath := filepath.Join(projectPath, "frontend")
	nodeModules := filepath.Join(frontendPath, "node_modules")

	if _, err := os.Stat(nodeModules); err == nil {
		logger.Logf("前端依赖已存在")
		return nil
	}

	logger.Logf("正在安装前端依赖（可能需要几分钟）...")

	npmPath := resolveNpm(nodePath)
	cmd := exec.Command(npmPath, "install")
	cmd.Dir = frontendPath
	if mirrorURL != "" {
		cmd.Env = append(os.Environ(), "npm_config_registry="+mirrorURL)
	}

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("npm install 启动失败: %w", err)
	}

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			logger.Logf("[npm] %s", scanner.Text())
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			logger.Logf("[npm ERR] %s", scanner.Text())
		}
	}()

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("npm install 失败: %w", err)
	}

	logger.Logf("前端依赖安装完成")
	return nil
}

func Start(projectPath, nodePath string, logger Logger) (*exec.Cmd, error) {
	frontendPath := filepath.Join(projectPath, "frontend")

	npmPath := resolveNpm(nodePath)
	cmd := exec.Command("cmd", "/c", npmPath, "run", "electron-dev")
	cmd.Dir = frontendPath

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("启动前端失败: %w", err)
	}

	logger.Logf("前端启动成功 (PID: %d)", cmd.Process.Pid)

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			logger.Logf("[Electron] %s", scanner.Text())
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			logger.Logf("[Electron ERR] %s", scanner.Text())
		}
	}()

	return cmd, nil
}

func resolveNpm(nodePath string) string {
	npmPath := filepath.Join(filepath.Dir(nodePath), "npm.cmd")
	if _, err := os.Stat(npmPath); err == nil {
		return npmPath
	}
	return "npm"
}
