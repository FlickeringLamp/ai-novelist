# 青烛 v0.2.0

![项目截图](images/示例图片.png)
## 项目介绍

青烛(正式名)是一个文本创作工具，主要探索AI在文本创作领域的应用。

**核心功能**:
*   **AI 智能交互**: 与AI进行实时对话，辅助创作。
*   **章节管理**: 创建、编辑、删除和组织章节。
*   **内容编辑器**: 强大的文本编辑功能，ai操作友好，非技术用户使用体验略逊
*   **工具调用**: 支持类似 vibecoding 的工具调用解决问题，目前部分功能仍在完善中。
*   **rag知识库**: 允许ai获得相关资料，提升效果

## 技术栈

### 前端技术 (TypeScript)
*   **React**: 前端主流框架之一
*   **Redux**: 前端状态管理库
*   **Tailwind CSS**: CSS框架
*   **monaco-editor**: vscode同款编辑器

### 后端技术 (python)
*   **FastAPI**: python服务器框架
*   **LangChain**: 用于构建AI应用的工具链
*   **LangGraph**: 基于图的AI工作流编排框架
*   **ChromaDB**: 向量数据库，提供语义搜索和知识库管理


## Languages(2026/2/11)
| language | files | code | comment | blank | total |
| :--- | ---: | ---: | ---: | ---: | ---: |
| TypeScript JSX | 55 | 5,567 | 357 | 709 | 6,633 |
| Python | 41 | 3,283 | 1,189 | 813 | 5,285 |
| TypeScript | 15 | 1,096 | 151 | 170 | 1,417 |
| Markdown | 3 | 234 | 0 | 88 | 322 |
| PostCSS | 4 | 180 | 18 | 29 | 227 |
| JavaScript | 4 | 78 | 44 | 12 | 134 |
| JSON | 1 | 78 | 0 | 1 | 79 |
| JSON with Comments | 1 | 29 | 19 | 7 | 55 |
| Ignore | 1 | 20 | 5 | 5 | 30 |
| HTML | 1 | 14 | 0 | 1 | 15 |


## 项目结构(2026.1.26)

前端：
📦src
 ┣ 📂components                           # 组件文件夹
 ┃ ┣ 📂agent                              ## agent面板
 ┃ ┃ ┣ 📜AgentPanel.tsx                   ### 1. agent主面板文件
 ┃ ┃ ┣ 📂common
 ┃ ┃ ┣ 📂parameterTab                     ### 2. 参数管理面板
 ┃ ┃ ┣ 📂toolTab                          ### 3. 工具管理面板
 ┃ ┃ ┣ 📜FileSelector.tsx
 ┃ ┃ ┗ 📜ModeManager.ts
 ┃ ┣ 📂aiprovider                         ## api提供商面板
 ┃ ┃ ┗ 📜ProviderSettingsPanel.tsx
 ┃ ┣ 📂chapter                            ## 章节栏
 ┃ ┃ ┣ 📜ChapterTreePanel.tsx             ### 1. 文件主面板
 ┃ ┃ ┣ 📜ChapterContextMenu.tsx           ### 1.1 文件右键菜单
 ┃ ┃ ┗ 📜TreeRender.tsx                   ### 1.2 文件树渲染
 ┃ ┣ 📂chat                               ## 聊天栏
 ┃ ┃ ┣ 📂header                           ### 1. 顶部框
 ┃ ┃ ┣ 📂messagedisplay                   ### 2. 消息框
 ┃ ┃ ┣ 📂input                            ### 3. 输入框
 ┃ ┃ ┗ 📜ChatPanel.tsx                    ### 4. 主聊天面板
 ┃ ┣ 📂editor
 ┃ ┃ ┣ 📂editor
 ┃ ┃ ┃ ┣ 📜CoreEditor.tsx
 ┃ ┃ ┃ ┣ 📜EditorArea.tsx
 ┃ ┃ ┃ ┗ 📜StatusBar.tsx
 ┃ ┃ ┣ 📂tab
 ┃ ┃ ┃ ┗ 📜CloseTabConfirmModal.tsx
 ┃ ┃ ┣ 📜EditorContextMenu.tsx
 ┃ ┃ ┗ 📜EditorPanel.tsx
 ┃ ┣ 📂others
 ┃ ┃ ┣ 📜ContextMenu.tsx
 ┃ ┃ ┣ 📜ErrorModal.tsx
 ┃ ┃ ┣ 📜Logo.css
 ┃ ┃ ┣ 📜Logo.tsx
 ┃ ┃ ┗ 📜UnifiedModal.tsx
 ┃ ┣ 📂rag
 ┃ ┃ ┗ 📜RagManagementPanel.tsx
 ┃ ┣ 📜LayoutComponent.tsx
 ┃ ┗ 📜SidebarComponent.tsx
 ┣ 📂context // 主题上下文
 ┃ ┗ 📜ThemeContext.tsx
 ┣ 📂store // redux状态管理
 ┃ ┣ 📜editor.ts
 ┃ ┣ 📜file.ts
 ┃ ┗ 📜store.ts
 ┣ 📂utils // 工具函数
 ┃ ┣ 📜DisplayNameHelper.ts
 ┃ ┣ 📜embeddingModelUtils.ts
 ┃ ┗ 📜httpClient.ts
 ┣ 📜App.css
 ┣ 📜App.tsx
 ┣ 📜css.d.ts
 ┣ 📜index.css
 ┗ 📜index.tsx


## 已知问题

以下是目前已知但暂未修复的问题：

- **工具调用功能不完善**: 部分工具调用功能仍在开发中，可能存在不稳定的情况， 且与其他功能（章节栏，标签页等）不协调
- **聊天栏功能不完善**：目前历史消息，回档，文件补全，模式选择，自动批准，rag知识库，以及部分工具功能能，暂未实现

## 后续发展规划

### 短期目标（v0.2.0）
- 完善工具调用功能（2026/2/12）
    - 解决编辑器渲染落后于聊天栏的问题（）
        - 推测问题：使用useEffect实时监测文件工具调用
        - 问题可能来源于redux的异步机制问题
        - 也可能来源于浏览器频繁计算刷新，性能问题导致的延迟
    - 提升apply_diff工具的调用成功率
    - 重构前端聊天板块的输入与展示部分，避免文件臃肿
    - 修复其他工具
    - 修复前端“批准/拒绝”按钮的显示，应该在点击操作后及时关闭（√）
    - 美化“批准/拒绝”按钮（√）
- 完成聊天栏全部功能
    - 输入栏的自动补全文件路径
    - 选择模式按钮
    - 自动批准按钮
    - 历史消息板块
    - 总结对话历史
    - 新建对话板块
    - 两步rag & 工具rag检索，两种rag检索并存
- 部分功能自动化测试

### 中期目标（v0.3.0）
- 可视化工作流编辑器（类dify）
- 更灵活的AI聊天功能（类酒馆？？？）
- mcp，skills功能

### 长期目标（v1.0.0）
- 暂无


## 快速开始

### 安装&启动

1.  **克隆仓库**:
    ```bash
    git clone git@github.com:FlickeringLamp/ai-novelist.git
    cd ai-novelist
    ```


2.  **安装前端依赖**:
    进入前端目录 (`frontend/`) 并安装依赖,构建前端，启动：
    ```bash
    cd frontend
    npm install
    npm run build
    npm start
    ```


3.  **安装后端依赖**:
    从根目录(`ai-novelist`)创建虚拟环境，激活，并安装后端依赖,回到根目录，启动：
    ```bash
    python -m venv backend_env
    backend_env\Scripts\activate
    cd backend
    pip install -r requirements.txt
    cd ..
    python main.py
    ```

5. **浏览器访问**：
    浏览器访问localhost:3000




## 贡献

我们欢迎各种形式的贡献！如果您发现 Bug、有功能建议或希望提交代码，请随时通过 GitHub Issues 或 Pull Requests 参与。

为了保持项目的健康发展，请确保：
- 提交的代码与 [MIT 协议](LICENSE) 兼容
- 避免引入与 MIT 协议不兼容的代码

感谢每一位贡献者的支持！

## 许可证

本项目采用 [MIT 许可证](LICENSE)。


---

## 致谢 (Acknowledgements)

本项目的开发在一定程度上借鉴了 `roo-code` 项目。我们对 `roo-code` 的开发者们表示衷心的感谢。

`roo-code` 项目基于 Apache License 2.0 开源。根据其许可证要求，我们在项目中包含了其原始的许可证声明，您可以在 [`LICENSE-roo-code.txt`](./LICENSE-roo-code.txt) 文件中查看。
