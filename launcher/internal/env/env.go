package env

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type Logger interface {
	Logf(format string, args ...interface{})
	Progress(percent int)
}

func getBinDir(baseDir string) string {
	return filepath.Join(baseDir, "bin")
}

func DetectPython(baseDir string) (string, bool) {
	binDir := getBinDir(baseDir)
	candidates := []string{
		filepath.Join(binDir, "python", "python.exe"),
		filepath.Join(binDir, "python.exe"),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c, true
		}
	}
	if p, err := exec.LookPath("python"); err == nil {
		return p, true
	}
	if p, err := exec.LookPath("python3"); err == nil {
		return p, true
	}
	return "", false
}

func DetectNode(baseDir string) (string, bool) {
	binDir := getBinDir(baseDir)
	candidates := []string{
		filepath.Join(binDir, "node", "node.exe"),
		filepath.Join(binDir, "node.exe"),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c, true
		}
	}
	if p, err := exec.LookPath("node"); err == nil {
		return p, true
	}
	return "", false
}

func DownloadPython(baseDir string, logger Logger) error {
	binDir := getBinDir(baseDir)
	os.MkdirAll(binDir, os.ModePerm)

	pythonDir := filepath.Join(binDir, "python")
	os.MkdirAll(pythonDir, os.ModePerm)

	url := "https://mirrors.tuna.tsinghua.edu.cn/python/3.12.7/python-3.12.7-embed-amd64.zip"
	zipPath := filepath.Join(binDir, "python.zip")

	logger.Logf("正在下载 Python 3.12.7 ...")
	if err := downloadFile(url, zipPath, logger); err != nil {
		return fmt.Errorf("下载 Python 失败: %w", err)
	}

	logger.Logf("正在解压 Python ...")
	if err := unzip(zipPath, pythonDir); err != nil {
		return fmt.Errorf("解压 Python 失败: %w", err)
	}
	os.Remove(zipPath)

	// 修改 python312._pth 启用 site-packages
	pthFile := filepath.Join(pythonDir, "python312._pth")
	if data, err := os.ReadFile(pthFile); err == nil {
		content := strings.ReplaceAll(string(data), "#import site", "import site")
		os.WriteFile(pthFile, []byte(content), os.ModePerm)
	}

	// 下载并安装 pip
	pipURL := "https://bootstrap.pypa.io/get-pip.py"
	pipPath := filepath.Join(pythonDir, "get-pip.py")
	logger.Logf("正在下载 pip ...")
	if err := downloadFile(pipURL, pipPath, nil); err != nil {
		return fmt.Errorf("下载 pip 失败: %w", err)
	}

	pythonExe := filepath.Join(pythonDir, "python.exe")
	logger.Logf("正在安装 pip ...")
	cmd := exec.Command(pythonExe, pipPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("安装 pip 失败: %w\n%s", err, string(out))
	}

	logger.Logf("Python 安装完成")
	return nil
}

func DownloadNode(baseDir string, logger Logger) error {
	binDir := getBinDir(baseDir)
	os.MkdirAll(binDir, os.ModePerm)

	nodeDir := filepath.Join(binDir, "node")

	url := "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/v20.18.1/node-v20.18.1-win-x64.zip"
	zipPath := filepath.Join(binDir, "node.zip")

	logger.Logf("正在下载 Node.js 20.18.1 ...")
	if err := downloadFile(url, zipPath, logger); err != nil {
		return fmt.Errorf("下载 Node 失败: %w", err)
	}

	logger.Logf("正在解压 Node.js ...")
	tmpDir := filepath.Join(binDir, "node_tmp")
	os.RemoveAll(tmpDir)
	os.MkdirAll(tmpDir, os.ModePerm)
	if err := unzip(zipPath, tmpDir); err != nil {
		return fmt.Errorf("解压 Node 失败: %w", err)
	}
	os.Remove(zipPath)

	// 移动内部目录到 node/
	entries, _ := os.ReadDir(tmpDir)
	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), "node-") {
			src := filepath.Join(tmpDir, entry.Name())
			os.RemoveAll(nodeDir)
			if err := os.Rename(src, nodeDir); err != nil {
				return fmt.Errorf("移动 Node 目录失败: %w", err)
			}
			break
		}
	}
	os.RemoveAll(tmpDir)

	logger.Logf("Node.js 安装完成")
	return nil
}

func downloadFile(url, dest string, logger Logger) error {
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	total := resp.ContentLength
	var written int64
	buf := make([]byte, 32*1024)

	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			_, werr := out.Write(buf[:n])
			if werr != nil {
				return werr
			}
			written += int64(n)
			if logger != nil && total > 0 {
				pct := int(float64(written) / float64(total) * 100)
				logger.Progress(pct)
			}
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
	}
	return nil
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	os.MkdirAll(dest, os.ModePerm)

	for _, f := range r.File {
		fpath := filepath.Join(dest, f.Name)
		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, os.ModePerm)
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}
