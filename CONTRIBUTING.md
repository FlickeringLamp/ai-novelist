[English](CONTRIBUTING_EN.md) | **中文**

# 贡献指南

我们非常欢迎并感谢您对本项目的贡献！

## 如何贡献

### 1. 报告 Bug

如果您发现任何 Bug，请在 GitHub Issues 中提交一个 Bug 报告。请提供尽可能详细的信息，包括：
*   重现步骤
*   预期行为
*   实际行为
*   错误信息（如果有）
*   您的操作系统和环境信息

### 2. 提交功能请求

如果您有新的功能建议，也请在 GitHub Issues 中提交一个功能请求。请详细描述您的想法，以及它将如何改进项目。

### 3. 提交代码

**重要：在开始编码前，请先创建 Issue 讨论**

为了避免您的工作白费，我们建议以下流程：

1.  **创建 Issue**: 在提交代码之前，请先创建一个 Issue 描述您要修复的 Bug 或要实现的功能。这有助于：
    - 确认该问题/功能是否已经被处理
    - 讨论实现方案，避免与项目方向不符
    - 获得维护者的反馈和建议

2.  **Fork 仓库**: 将本项目仓库 Fork 到您自己的 GitHub 账户。

3.  **克隆仓库**: 将您 Fork 的仓库克隆到本地。
    ```bash
    git clone git@github.com:FlickeringLamp/ai-novelist.git
    cd ai-novelist
    ```

4.  **创建分支**: 为您的功能或 Bug 修复创建一个新的分支。
    ```bash
    git checkout -b feature/your-feature-name
    ```

5.  **进行更改**: 编写您的代码，并进行测试。

6.  **提交更改**: 提交您的更改。
    ```bash
    git commit -m "feat: Add your feature"
    ```

7.  **推送分支**: 将您的更改推送到您 Fork 的仓库。
    ```bash
    git push origin feature/your-feature-name
    ```

8.  **创建 Pull Request**: 在 GitHub 上创建一个 Pull Request，从您的 Fork 分支到本项目的主分支。请：
    - 在 PR 描述中引用相关的 Issue（如 `Fixes #123`）
    - 详细描述您的更改内容

## 贡献规则

为了确保项目的健康发展，请遵循以下基本规则：

- **许可证兼容性**: 所有提交的代码都必须是原创或明确兼容 [MIT 协议](LICENSE) 的。**严禁引入任何 GPL、AGPL 或其他 Copyleft 协议的代码**，这些协议可能会对项目产生限制。

- **代码质量**: 请确保您的代码具有良好的可读性和可维护性。

- **测试覆盖**: 如果可能，请为您的更改添加相应的测试。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。MIT 许可证明确允许商业使用、修改、分发和私有化部署。
