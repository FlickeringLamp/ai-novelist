package backend

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

type Logger interface {
	Logf(format string, args ...interface{})
}

func EnsureVenv(projectPath, pythonPath string, logger Logger) (string, error) {
	venvDir := filepath.Join(projectPath, "venv")
	venvPython := filepath.Join(venvDir, "Scripts", "python.exe")

	if _, err := os.Stat(venvPython); err == nil {
		logger.Logf("虚拟环境已存在")
		return venvPython, nil
	}

	logger.Logf("正在创建虚拟环境 ...")
	cmd := exec.Command(pythonPath, "-m", "venv", venvDir)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("创建虚拟环境失败: %w\n%s", err, string(out))
	}

	logger.Logf("虚拟环境创建完成")
	return venvPython, nil
}

func PipInstall(projectPath, venvPython, mirrorURL string, logger Logger) error {
	reqFile := filepath.Join(projectPath, "backend", "requirements.txt")
	if _, err := os.Stat(reqFile); os.IsNotExist(err) {
		return fmt.Errorf("requirements.txt 不存在: %s", reqFile)
	}

	logger.Logf("正在升级 pip ...")
	upgradeArgs := []string{"-m", "pip", "install", "--upgrade", "pip"}
	if mirrorURL != "" {
		upgradeArgs = append(upgradeArgs, "-i", mirrorURL)
	}
	cmd := exec.Command(venvPython, upgradeArgs...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		logger.Logf("升级 pip 警告: %v", err)
	} else {
		logger.Logf("pip 升级完成")
	}
	_ = out

	logger.Logf("正在安装后端依赖（可能需要几分钟）...")
	installArgs := []string{"-m", "pip", "install", "-r", reqFile}
	if mirrorURL != "" {
		installArgs = append(installArgs, "-i", mirrorURL)
	}
	cmd = exec.Command(venvPython, installArgs...)

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("pip install 启动失败: %w", err)
	}

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			logger.Logf("[pip] %s", scanner.Text())
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			logger.Logf("[pip ERR] %s", scanner.Text())
		}
	}()

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("pip install 失败: %w", err)
	}

	logger.Logf("后端依赖安装完成")
	return nil
}

func Start(projectPath, venvPython string, logger Logger) (*exec.Cmd, error) {
	mainPy := filepath.Join(projectPath, "main.py")
	if _, err := os.Stat(mainPy); os.IsNotExist(err) {
		return nil, fmt.Errorf("main.py 不存在: %s", mainPy)
	}

	cmd := exec.Command(venvPython, mainPy)
	cmd.Dir = projectPath

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("启动后端失败: %w", err)
	}

	logger.Logf("后端启动成功 (PID: %d)", cmd.Process.Pid)

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			logger.Logf("[Backend] %s", scanner.Text())
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			logger.Logf("[Backend ERR] %s", scanner.Text())
		}
	}()

	return cmd, nil
}

func WaitForHealthy(port int, timeout time.Duration) error {
	url := fmt.Sprintf("http://127.0.0.1:%d/health", port)
	client := &http.Client{Timeout: 5 * time.Second}
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(800 * time.Millisecond)
	}
	return fmt.Errorf("后端健康检查超时 (%ds)", int(timeout.Seconds()))
}
