**English** | [中文](README.md)

# QingZhu v0.2.0

## Project Introduction
- **QingZhu** (official name) is a text creation tool, primarily exploring the application of AI in text creation.
- **Supported Platforms**: Ubuntu 24.04, Windows 11
- Respects different users' habits by not providing pre-made "one-click features"
- Aims to integrate AI into the writing process, improving efficiency and extending the author's thinking, rather than replacing the author

---

# Core Features

## 0. Built-in Butler Agent
Allows AI to operate backend APIs, directly performing actions on behalf of the user (currently in early stages)

---

## 1. Tool Calling
Consistent with the core logic of Cursor / Cline / Roo Code / Kilo Code, with some design differences:

- **Reference-based file reading**: Uses reference updates, eliminating the need for repeated reads, saving token costs, and improving accuracy
- **Hashline Solution**: Inspired by Can Duruk's Hashline approach, the diff replacement tool doesn't require outputting the full old content—only two-character hashes are needed, further reducing costs and improving accuracy

Supports **Human-in-the-Loop**, encouraging users to frequently intervene in AI content generation for timely corrections

You can also enable **Auto-Approval** to let AI fully automate task execution

![1](./images/1.png)

---

## 2. Themes
Supports Day/Night modes and custom theme color schemes

![2](./images/2.png)

---

## 3. RAG Knowledge Base
Allows AI to retrieve necessary information, improving results

![8](./images/8.png)

- **Two-step RAG**: Before calling AI, uses the user's message as input to retrieve relevant information, which is returned to AI along with other context
- **Agentic RAG**: Gives AI two knowledge base tools, allowing AI to autonomously decide whether to query data

---

## 4. Regular Search
Standard text editor feature

Allows users to search through text

![4](./images/4.png)

---

## 5. Checkpoints
Standard text editor feature

Allows users to save file content as checkpoints, restore to previous versions, and view differences between different checkpoints

![5](./images/5.png)

---

## 6. Provider Adaptation

Supports **11 providers**

Supports **custom providers** (OpenAI-compatible)

Includes a built-in embedding model, ready to use out of the box

![6](./images/6.png)

---

## 7. MCP Client

Supports connecting to MCP servers

![10](./images/10.png)

---

## 8. Skills Support

Can integrate various skills, similar to OpenClaw and Claude Code

![3](./images/3.png)

---

## 9. Others:
*   **Command Execution**: Allows AI to execute commands directly, such as Python, npm, etc.
*   **Terminal**: Terminal panel similar to VS Code and other editors, capable of executing command lines
*   ...and more

---

# Tech Stack

## Frontend Technologies
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Redux](https://img.shields.io/badge/Redux-764ABC?style=for-the-badge&logo=redux&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Monaco Editor](https://img.shields.io/badge/Monaco%20Editor-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)
![React DnD](https://img.shields.io/badge/React%20DnD-FF9900?style=for-the-badge&logo=react&logoColor=white)
![XTerm.js](https://img.shields.io/badge/XTerm.js-000000?style=for-the-badge&logo=windowsterminal&logoColor=white)

## Backend Technologies
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![ChromaDB](https://img.shields.io/badge/ChromaDB-333333?style=for-the-badge&logo=chromadb&logoColor=white)
![LiteLLM](https://img.shields.io/badge/LiteLLM-1E1E1E?style=for-the-badge&logo=openai&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-000000?style=for-the-badge&logo=protocols.io&logoColor=white)
![Llama.cpp](https://img.shields.io/badge/Llama.cpp-6C757D?style=for-the-badge&logo=ollama&logoColor=white)
![GitPython](https://img.shields.io/badge/GitPython-F05032?style=for-the-badge&logo=git&logoColor=white)

## Development & Build Tools
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

## Languages
| Language | Files | Code | Comment | Blank | Total |
| :--- | ---: | ---: | ---: | ---: | ---: |
| TypeScript JSX | 76 | 8,297 | 618 | 1,019 | 9,934 |
| Python | 63 | 4,398 | 2,189 | 1,342 | 7,929 |
| TypeScript | 38 | 3,062 | 632 | 587 | 4,281 |
| Markdown | 8 | 576 | 0 | 87 | 663 |
| YAML | 3 | 480 | 60 | 37 | 577 |
| JavaScript | 10 | 464 | 87 | 81 | 632 |
| PostCSS | 4 | 185 | 19 | 30 | 234 |
| JSON | 3 | 145 | 0 | 2 | 147 |
| Skill | 2 | 62 | 0 | 21 | 83 |
| pip requirements | 1 | 33 | 0 | 0 | 33 |
| JSON with Comments | 1 | 29 | 19 | 7 | 55 |
| HTML | 1 | 14 | 0 | 1 | 15 |

---

# Quick Start

## Installation & Startup

### 1. Clone the Repository
```bash
git clone git@github.com:FlickeringLamp/ai-novelist.git
cd ai-novelist
```

### 2. Install Frontend Dependencies
Enter the frontend directory (`frontend/`), install dependencies, build, and start:
```bash
cd frontend
npm install
npm run build
npm start
```

### 3. Install Backend Dependencies
From the root directory (`ai-novelist`), create a virtual environment, activate it, install backend dependencies, then return to root and start:
```bash
# Windows
python -m venv backend_env
backend_env\Scripts\activate

# Linux/macOS
python -m venv backend_env
source backend_env/bin/activate

cd backend
pip install -r requirements.lock
cd ..
python main.py
```

> **Note**: Using `requirements.lock` ensures all dependencies are fully version-locked to avoid compatibility issues. For development environments that need the latest versions, use `requirements.txt` instead.

### 4. Access via Browser
Open your browser and visit: http://localhost:3000

### 5. Other Startup Methods
From the root directory:
```bash
cd frontend
npm run electron-dev
```

**Note**: When starting with `electron-dev`, the terminal feature is available. The web version lacks the Node.js main process, so the terminal feature is unavailable.

---

# Development Roadmap

## Short-term Goals (v0.2.0)
- Ensure all butler agent features are functional, add special tools and feature examples
  - API fill-in tool (ask interaction tool upgrade)
  - A knowledge base aggregating all encountered issues
  - Allow users to manually clear loaded files to prevent AI from forgetting to clean up, and automatically trigger cleanup when files reach a specified count

## Medium-term Goals (v0.3.0)
- Subagent system
- Long-term memory functionality
- Search tool return results may need to add IDs (paragraph - two-character hash)
- After deleting files, need to update AI's loaded file list
- Subagent, multi-agent system
- Git checkpoint feature with branch support
- Automated testing for some features
- Multimodal, image upload
- Visual workflow editor (similar to Dify)
- Left/right paging for message checkpoint restoration
- When releasing interruption, user messages and tool results should optimistically update in order (tool result first, then user message), may require backend refactoring to merge different checkpoint data before sending to frontend for rendering, which would also enable message paging
- ComfyUI-related features
- More flexible AI chat features (similar to Tavern?)
- Tool enhancements
  - Bug: When AI previously used a tool (e.g., `write_file`), and the tool's permissions and usage instructions are subsequently disabled, if AI attempts to call this disabled tool, it will error. But it's controllable—after rendering crash, open the message and delete the last call.
- Notify provider to stop generation during interruption? Need to reference other projects for implementation
- Without API key, AI can forcibly create knowledge bases using backend ports, and can't even delete them?
- Allow users to open folders as working directories
- apply_diff: No need to mimic Roo Code and other AI IDE logic for now, current logic should be sufficient
- Add `memory_edit` tool, allowing AI to directly edit its own context (? no clear ideas yet)

## Long-term Goals (v1.0.0)
- To be determined

---

# Contributing

We welcome contributions in all forms! If you find bugs, have feature suggestions, or want to submit code, please participate through GitHub Issues or Pull Requests.

Detailed guides:
- [Contributing Guide](CONTRIBUTING_EN.md) - How to submit Issues, PRs, and workflow
- [Development Standards](DEVELOPMENT_EN.md) - Code style, project structure conventions

We don't oppose AI-assisted programming, but please ensure your agent understands these file requirements, and ensure you understand what the AI is writing—otherwise, it may not be merged.
- [Agent Guidelines](AGENT.md)

To maintain the project's healthy development, please ensure:
- Submitted code is compatible with the [MIT License](LICENSE)
- Follow the conventions in [Development Standards](DEVELOPMENT_EN.md)

Thank you to every contributor for your support!

---

# License

This project is licensed under the [MIT License](LICENSE).

---

# Acknowledgements

The development of this project has been partially inspired by the `roo-code` project. We express our heartfelt thanks to the developers of `roo-code`.

The `roo-code` project is open-sourced under the Apache License 2.0. According to its license requirements, we have included its original license statement in the project, which you can view in the [`LICENSE-roo-code.txt`](./LICENSE-roo-code.txt) file.
