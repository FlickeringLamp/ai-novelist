# 青烛 v0.2.0

![项目截图](images/示例图片.png)
## 项目介绍

青烛(正式名)是一个文本创作工具，主要探索AI在文本创作领域的应用。

**核心功能**:
*   **章节管理**: 创建、编辑、删除和组织章节。
*   **内容编辑器**: 强大的文本编辑功能，ai操作友好，非技术用户使用体验略逊
*   **工具调用**: 支持类似 vibecoding 的工具调用解决问题，目前部分功能仍在完善中。
*   **rag知识库**: 允许ai获得相关资料，提升效果
*   **mcp客户端**： 支持接入mcp服务器，stdio(npx/uvx)，http（streamable-http）, sse。
*   **skills支持**: 可以接入各种skills
*   **消息回档**: 消息自动存档，随时修改目标气泡。
*   **文件回档**：文件手动存档，允许进度回退。
*   **命令执行**： 允许ai直接执行命令，比如python,npm等
*   **终端**： 类似vscode等编辑器的终端面板，可执行命令行

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

Total : 201 files,  17055 codes, 3442 comments, 3062 blanks, all 23559 lines


## Languages
| language | files | code | comment | blank | total |
| :--- | ---: | ---: | ---: | ---: | ---: |
| TypeScript JSX | 74 | 7,982 | 591 | 978 | 9,551 |
| Python | 61 | 4,293 | 2,105 | 1,294 | 7,692 |
| TypeScript | 34 | 2,829 | 561 | 523 | 3,913 |
| Markdown | 7 | 576 | 0 | 88 | 664 |
| JavaScript | 10 | 464 | 87 | 81 | 632 |
| YAML | 3 | 446 | 60 | 37 | 543 |
| PostCSS | 4 | 185 | 19 | 30 | 234 |
| JSON | 3 | 142 | 0 | 2 | 144 |
| Skill | 2 | 62 | 0 | 21 | 83 |
| pip requirements | 1 | 33 | 0 | 0 | 33 |
| JSON with Comments | 1 | 29 | 19 | 7 | 55 |
| HTML | 1 | 14 | 0 | 1 | 15 |


## 已知问题

以下是目前已知但暂未修复的问题：

- **工具调用功能不完善**: 部分工具功能与其他功能（章节栏，标签页等）不协调

## 后续发展规划

### 短期目标（v0.2.0）
- 消息回档————类似cherrystudio的左右翻页还没做（暂时跳过）
- 确保管家agent所有功能可用，增加一些特殊工具,功能案例等,
    - 给个API填写工具（ask交互工具升级）
    - 一个知识库，汇总碰到的所有问题
    - 允许用户手动清理加载的文件，避免AI忘记清理，以及当文件到达指定的数量时自动触发清理逻辑。
- 长期记忆功能（）
- subagent?（）
- 右侧聊天栏的上下文token显示有点问题
- apply_diff工具可以进一步简化和重构，不再需要原内容（）
- 限制检索工具的结果数，避免上下文爆炸（）
- 临时添加工具结果/及时获取工具结果并渲染/中断返回结果时先返回state，让工具结果消息先渲染，再流式渲染中断消息（）
- 总结对话历史()————存在点小问题，比如，保留了倒数第二条消息，但是却显示没有发给ai
- 我觉得前后端可以互通一下标签页状态，这样后端就知道哪些文件内容在显示中，由此即可触发文件内容的实时同步（？）
- 检查一下CRLF和LF？windows和ubuntu混着写的，好像在不同平台会出bug来着。

### 中期目标（v0.3.0）
- subagent，多agent系统
- git存档功能支持分支
- 部分功能自动化测试
- 多模态，上传图片
- 可视化工作流编辑器（类dify）
- comfyUI相关功能
- 更灵活的AI聊天功能（类酒馆？？？）
- 工具加强
    - bug————当ai先前使用过工具（假如write_file），后续关闭使用该工具的权限与使用说明。一旦ai试图调用这个关闭的工具，就会报错。但是可控，渲染崩溃后，打开消息，删掉最后一个调用就好。
- 中断时通知提供商停止生成？这个需要参考别人的项目看看怎么实现的
- 没有API key，AI可以用后端端口强行创建知识库，甚至删不掉？
- 允许用户打开文件夹作为工作目录
- apply_diff，暂时不需要模仿roo code等AI IDE的逻辑了，当前的逻辑应该够用。
- 新增memory_edit工具，允许ai直接编辑自己的上下文（？暂时还没有思路）


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

4. **浏览器访问**：
    浏览器访问http://localhost:3000

5. **其他启动方式**:
    从根目录开始
    ```bash
    cd frontend
    npm run electron-dev
    ```

    **注意**：
    electron-dev启动时，可以使用终端功能，web端没有Node.js主进程，无法使用终端功能。


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
