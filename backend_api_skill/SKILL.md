---
name: backend-api
description: 直接调用后端 API，直接控制项目配置、文件管理、知识库、MCP 等核心功能
---

# Backend API Skill

通过调用后端 REST API，AI 可以直接管理项目的各个方面。

## 功能范围

- **配置管理**：读取和修改系统配置、模式、模型提供商等
- **文件操作**：管理项目文件、读取和修改内容
- **知识库**：创建、管理和搜索知识库内容
- **MCP 服务器**：管理 MCP 服务器配置
- **对话历史**：管理对话记录和检查点

## API 文档

详见同目录下的各个 API 文档文件：
- `config_api_docs.md` - 配置相关 API
- `file_api_docs.md` - 文件操作 API
- `history_api_docs.md` - 历史记录 API
- `knowledge_api_docs.md` - 知识库 API
- `mcp_api_docs.md` - MCP 服务器 API
- `mode_api_docs.md` - 模式管理 API
- `tool_api_docs.md` - 工具相关 API
- `store_template.yaml` - 示例配置文件

你可以根据这些文档，使用命令行工具，构造请求体
调用位于localhost:8000 的这些端点