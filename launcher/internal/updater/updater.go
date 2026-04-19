package updater

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v6"
	"github.com/go-git/go-git/v6/config"
	"github.com/go-git/go-git/v6/plumbing"
	"gopkg.in/yaml.v3"
)

const ConfigFile = "config.yaml"

type Config struct {
	App struct {
		Name           string `yaml:"name"`
		MainExecutable string `yaml:"main_executable"`
	} `yaml:"app"`
	Git struct {
		RemoteURL  string `yaml:"remote_url"`
		ProjectDir string `yaml:"project_dir"`
	} `yaml:"git"`
	Mirror string `yaml:"mirror"`
}

var PipMirrors = map[string]string{
	"tsinghua": "https://pypi.tuna.tsinghua.edu.cn/simple",
	"aliyun":   "https://mirrors.aliyun.com/pypi/simple/",
}

var NpmMirrors = map[string]string{
	"tsinghua": "https://mirrors.tuna.tsinghua.edu.cn/npm/",
	"aliyun":   "https://registry.npmmirror.com/",
}

type CommitInfo struct {
	SHA     string `json:"sha"`
	Message string `json:"message"`
	Date    string `json:"date"`
}

type UpdateStatus struct {
	HasUpdate    bool        `json:"has_update"`
	RemoteCommit CommitInfo  `json:"remote_commit"`
	LocalCommit  *CommitInfo `json:"local_commit,omitempty"`
}

type Logger interface {
	Logf(format string, args ...interface{})
	Progress(percent int)
}

// getBaseDir() 获取的是运行的exe所在的绝对路径（目录），因为go是编译型语言，不感知源码文件
func getBaseDir() string {
	exePath, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exePath)
}

func configPath() string {
	return filepath.Join(getBaseDir(), ConfigFile)
}

func LoadConfig() (*Config, error) {
	data, err := os.ReadFile(configPath())
	if err != nil {
		return nil, err
	}
	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, err
	}
	if config.Git.ProjectDir == "" {
		config.Git.ProjectDir = "qingzhu"
	}
	if config.Mirror == "" {
		config.Mirror = "tsinghua"
	}
	return &config, nil
}

func SaveConfig(config *Config) error {
	data, err := yaml.Marshal(config)
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), data, 0644)
}

func parseGiteeRepo(remoteURL string) (owner, repo string, err error) {
	remoteURL = strings.TrimSuffix(remoteURL, ".git")
	if strings.Contains(remoteURL, "gitee.com") {
		parts := strings.Split(remoteURL, "/")
		if len(parts) >= 2 {
			owner = parts[len(parts)-2]
			repo = parts[len(parts)-1]
			return owner, repo, nil
		}
	}
	return "", "", fmt.Errorf("无法解析 gitee 仓库地址: %s", remoteURL)
}

func GetRemoteLatestCommit(remoteURL, branch string) (*CommitInfo, error) {
	owner, repo, err := parseGiteeRepo(remoteURL)
	if err != nil {
		return nil, err
	}
	apiURL := fmt.Sprintf("https://gitee.com/api/v5/repos/%s/%s/commits?sha=%s&per_page=1", owner, repo, branch)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("请求 Gitee API 失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Gitee API 返回错误 %d: %s", resp.StatusCode, string(body))
	}

	var commits []struct {
		SHA    string `json:"sha"`
		Commit struct {
			Message string `json:"message"`
			Author  struct {
				Date string `json:"date"`
			} `json:"author"`
		} `json:"commit"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&commits); err != nil {
		return nil, fmt.Errorf("解析 Gitee API 响应失败: %w", err)
	}
	if len(commits) == 0 {
		return nil, fmt.Errorf("远程仓库没有提交记录")
	}
	c := commits[0]
	return &CommitInfo{
		SHA:     c.SHA,
		Message: strings.TrimSpace(c.Commit.Message),
		Date:    c.Commit.Author.Date,
	}, nil
}

func GetLocalCommit(projectDir string) (*CommitInfo, error) {
	repo, err := git.PlainOpen(projectDir)
	if err != nil {
		return nil, err
	}
	head, err := repo.Head()
	if err != nil {
		return nil, err
	}
	commit, err := repo.CommitObject(head.Hash())
	if err != nil {
		return nil, err
	}
	return &CommitInfo{
		SHA:     head.Hash().String(),
		Message: strings.TrimSpace(commit.Message),
		Date:    commit.Committer.When.Format(time.RFC3339),
	}, nil
}

func CheckUpdateStatus(config *Config) (*UpdateStatus, error) {
	projectPath := filepath.Join(getBaseDir(), config.Git.ProjectDir)
	repo, err := git.PlainOpen(projectPath)
	currentBranch := "main"
	if err == nil {
		head, _ := repo.Head()
		if head != nil && head.Name().IsBranch() {
			currentBranch = head.Name().Short()
		}
	}

	remote, err := GetRemoteLatestCommit(config.Git.RemoteURL, currentBranch)
	if err != nil {
		return nil, err
	}
	local, _ := GetLocalCommit(projectPath)

	status := &UpdateStatus{
		HasUpdate:    true,
		RemoteCommit: *remote,
		LocalCommit:  local,
	}
	if local != nil && local.SHA == remote.SHA {
		status.HasUpdate = false
	}
	return status, nil
}

func createTrackingBranches(repo *git.Repository, logger Logger) error {
	refs, err := repo.References()
	if err != nil {
		return err
	}
	defer refs.Close()

	for {
		ref, err := refs.Next()
		if err != nil {
			break
		}
		if ref.Type() != plumbing.HashReference || !ref.Name().IsRemote() {
			continue
		}

		remoteBranch := ref.Name().Short()
		parts := strings.SplitN(remoteBranch, "/", 2)
		if len(parts) < 2 {
			continue
		}

		localName := parts[1]
		if localName == "HEAD" {
			continue
		}

		localRef := plumbing.NewBranchReferenceName(localName)
		_, err = repo.Reference(localRef, false)
		if err == nil {
			continue
		}

		newRef := plumbing.NewHashReference(localRef, ref.Hash())
		if err := repo.Storer.SetReference(newRef); err != nil {
			logger.Logf("创建本地分支 %s 失败: %v", localName, err)
			continue
		}

		if err := repo.CreateBranch(&config.Branch{
			Name:   localName,
			Remote: parts[0],
			Merge:  localRef,
		}); err != nil {
			logger.Logf("配置分支 %s 跟踪失败: %v", localName, err)
		}

		logger.Logf("创建本地分支: %s", localName)
	}
	return nil
}

func CloneOrPull(config *Config, logger Logger) error {
	baseDir := getBaseDir()
	projectPath := filepath.Join(baseDir, config.Git.ProjectDir)

	_, err := git.PlainOpen(projectPath)
	isRepo := err == nil

	if !isRepo {
		logger.Logf("本地未找到项目，开始克隆 %s ...", config.Git.RemoteURL)
		if _, err := os.Stat(projectPath); err == nil {
			logger.Logf("清理旧目录: %s", config.Git.ProjectDir)
			if err := os.RemoveAll(projectPath); err != nil {
				return fmt.Errorf("清理旧目录失败: %w", err)
			}
		}
		repo, err := git.PlainClone(projectPath, &git.CloneOptions{
			URL:      config.Git.RemoteURL,
			Progress: &logWriter{logger: logger},
		})
		if err != nil {
			return fmt.Errorf("克隆仓库失败: %w", err)
		}
		logger.Logf("克隆完成")
		logger.Logf("正在创建本地跟踪分支...")
		if err := createTrackingBranches(repo, logger); err != nil {
			logger.Logf("创建跟踪分支失败: %v", err)
		}
		return nil
	}

	logger.Logf("开始拉取更新...")
	repo, err := git.PlainOpen(projectPath)
	if err != nil {
		return fmt.Errorf("打开本地仓库失败: %w", err)
	}
	w, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("获取工作区失败: %w", err)
	}
	err = repo.Fetch(&git.FetchOptions{
		RemoteName: "origin",
		Progress:   &logWriter{logger: logger},
	})
	if err != nil && err != git.NoErrAlreadyUpToDate {
		return fmt.Errorf("获取远程更新失败: %w", err)
	}
	head, err := repo.Head()
	if err != nil {
		return fmt.Errorf("获取 HEAD 失败: %w", err)
	}
	if head.Name().IsBranch() {
		branchName := head.Name().Short()
		refName := plumbing.NewRemoteReferenceName("origin", branchName)
		ref, err := repo.Reference(refName, true)
		if err != nil {
			return fmt.Errorf("获取远程分支引用失败: %w", err)
		}
		err = w.Reset(&git.ResetOptions{
			Mode:   git.HardReset,
			Commit: ref.Hash(),
		})
		if err != nil {
			return fmt.Errorf("重置到最新提交失败: %w", err)
		}
	}
	logger.Logf("正在同步本地跟踪分支...")
	if err := createTrackingBranches(repo, logger); err != nil {
		logger.Logf("同步跟踪分支失败: %v", err)
	}

	logger.Logf("更新完成")
	return nil
}

type logWriter struct {
	logger Logger
}

func (w *logWriter) Write(p []byte) (n int, err error) {
	w.logger.Logf("%s", strings.TrimSpace(string(p)))
	return len(p), nil
}
