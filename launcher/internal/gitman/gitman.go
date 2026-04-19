package gitman

import (
	"fmt"
	"time"

	"github.com/go-git/go-git/v6"
	"github.com/go-git/go-git/v6/config"
	"github.com/go-git/go-git/v6/plumbing"
)

// CommitDetail 单条提交详情
type CommitDetail struct {
	SHA     string   `json:"sha"`
	Message string   `json:"message"`
	Date    string   `json:"date"`
	Author  string   `json:"author"`
	Parents []string `json:"parents"`
	IsHEAD  bool     `json:"is_head"`
}

// BranchInfo 分支信息
type BranchInfo struct {
	Name      string `json:"name"`
	IsRemote  bool   `json:"is_remote"`
	IsCurrent bool   `json:"is_current"`
	SHA       string `json:"sha"`
}

// GetCommitHistory 获取提交历史（从新到旧）
func GetCommitHistory(projectDir string, limit int) ([]CommitDetail, error) {
	repo, err := git.PlainOpen(projectDir)
	if err != nil {
		return nil, fmt.Errorf("打开仓库失败: %w", err)
	}

	head, err := repo.Head()
	if err != nil {
		return nil, fmt.Errorf("获取 HEAD 失败: %w", err)
	}

	iter, err := repo.Log(&git.LogOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取日志失败: %w", err)
	}
	defer iter.Close()

	var commits []CommitDetail
	for i := 0; i < limit; i++ {
		c, err := iter.Next()
		if err != nil {
			break
		}

		parents := make([]string, len(c.ParentHashes))
		for j, h := range c.ParentHashes {
			parents[j] = h.String()
		}

		commits = append(commits, CommitDetail{
			SHA:     c.Hash.String(),
			Message: c.Message,
			Date:    c.Committer.When.Format(time.RFC3339),
			Author:  c.Author.Name,
			Parents: parents,
			IsHEAD:  c.Hash == head.Hash(),
		})
	}

	return commits, nil
}

// GetBranches 获取本地与远程分支列表
func GetBranches(projectDir string) ([]BranchInfo, error) {
	repo, err := git.PlainOpen(projectDir)
	if err != nil {
		return nil, fmt.Errorf("打开仓库失败: %w", err)
	}

	head, err := repo.Head()
	if err != nil {
		return nil, fmt.Errorf("获取 HEAD 失败: %w", err)
	}

	var branches []BranchInfo

	// 本地分支
	iter, err := repo.Branches()
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	for {
		ref, err := iter.Next()
		if err != nil {
			break
		}
		branches = append(branches, BranchInfo{
			Name:      ref.Name().Short(),
			IsRemote:  false,
			IsCurrent: head.Name().String() == ref.Name().String(),
			SHA:       ref.Hash().String(),
		})
	}

	// 远程分支
	remIter, err := repo.References()
	if err != nil {
		return nil, err
	}
	defer remIter.Close()

	for {
		ref, err := remIter.Next()
		if err != nil {
			break
		}
		if ref.Type() == plumbing.HashReference && ref.Name().IsRemote() {
			branches = append(branches, BranchInfo{
				Name:      ref.Name().Short(),
				IsRemote:  true,
				IsCurrent: false,
				SHA:       ref.Hash().String(),
			})
		}
	}

	return branches, nil
}

// CheckoutCommit 硬重置到指定提交（版本回溯）
func CheckoutCommit(projectDir string, hash string) error {
	repo, err := git.PlainOpen(projectDir)
	if err != nil {
		return fmt.Errorf("打开仓库失败: %w", err)
	}

	w, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("获取工作区失败: %w", err)
	}

	h := plumbing.NewHash(hash)
	err = w.Reset(&git.ResetOptions{
		Mode:   git.HardReset,
		Commit: h,
	})
	if err != nil {
		return fmt.Errorf("重置到提交失败: %w", err)
	}
	return nil
}

// SwitchBranch 切换到已有分支；若本地不存在但远程存在，则自动创建本地跟踪分支
func SwitchBranch(projectDir string, name string) error {
	repo, err := git.PlainOpen(projectDir)
	if err != nil {
		return fmt.Errorf("打开仓库失败: %w", err)
	}

	w, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("获取工作区失败: %w", err)
	}

	localRef := plumbing.NewBranchReferenceName(name)
	_, err = repo.Reference(localRef, false)
	if err != nil {
		// 本地没有该分支，尝试从远程创建
		remoteName := "origin"
		remoteRefName := plumbing.NewRemoteReferenceName(remoteName, name)
		remoteRef, err := repo.Reference(remoteRefName, false)
		if err != nil {
			return fmt.Errorf("分支 %s 不存在（本地及远程）: %w", name, err)
		}

		// 创建本地分支引用
		newRef := plumbing.NewHashReference(localRef, remoteRef.Hash())
		if err := repo.Storer.SetReference(newRef); err != nil {
			return fmt.Errorf("创建本地分支引用失败: %w", err)
		}

		if err := repo.CreateBranch(&config.Branch{
			Name:   name,
			Remote: remoteName,
			Merge:  localRef,
		}); err != nil {
			return fmt.Errorf("创建分支配置失败: %w", err)
		}
	}

	err = w.Checkout(&git.CheckoutOptions{
		Branch: localRef,
		Force:  true,
	})
	if err != nil {
		return fmt.Errorf("切换分支失败: %w", err)
	}
	return nil
}

// CreateBranch 基于当前 HEAD 创建新分支
func CreateBranch(projectDir string, name string) error {
	repo, err := git.PlainOpen(projectDir)
	if err != nil {
		return fmt.Errorf("打开仓库失败: %w", err)
	}

	head, err := repo.Head()
	if err != nil {
		return fmt.Errorf("获取 HEAD 失败: %w", err)
	}

	// 创建分支配置
	err = repo.CreateBranch(&config.Branch{
		Name:   name,
		Remote: "origin",
	})
	if err != nil {
		return fmt.Errorf("创建分支配置失败: %w", err)
	}

	// 创建引用指向当前 HEAD
	newRef := plumbing.NewHashReference(plumbing.NewBranchReferenceName(name), head.Hash())
	err = repo.Storer.SetReference(newRef)
	if err != nil {
		return fmt.Errorf("创建分支引用失败: %w", err)
	}

	return nil
}
