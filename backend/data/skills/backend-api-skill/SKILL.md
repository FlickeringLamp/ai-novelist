---
name: backend-api
description: 直接调用后端 API，直接控制项目配置、文件管理、知识库、MCP 等核心功能
---

# 功能范围

- **配置管理**：读取和修改系统配置、模式、模型提供商等
- **文件操作**：管理项目文件、读取和修改内容
- **知识库**：创建、管理和搜索知识库内容
- **MCP 服务器**：管理 MCP 服务器配置
- **对话历史**：管理对话记录和检查点

## API文档 以及 配置文件

请勿使用curl功能直接向后端8000端口获取API文档，而是阅读这些文件
- [`history_api_docs.md`](./api/history_api_docs.md) - 历史记录 API
- [`knowledge_api_docs.md`](./api/knowledge_api_docs.md) - 知识库 API
- [`mcp_api_docs.md`](./api/mcp_api_docs.md) - MCP 服务器 API

配置示例：[`config/store_template.yaml`](./config/store_template.yaml)

调用方式示例：
使用命令执行工具，通过命令行调用后端的API

```bash
curl -X POST http://localhost:8000/api/history/checkpoints \
  -H "Content-Type: application/json" \
  -d '{"thread_id": "default"}'
```