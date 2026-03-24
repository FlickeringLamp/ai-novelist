"/api/mcp/tools": {
  "get": {
    "summary": "获取MCP工具字典",
    "description": "获取MCP工具字典\n\n- **server_id**: 可选的服务器ID，如果提供则只返回该服务器的工具\n\nReturns:\n    Dict[str, Dict]: MCP工具字典",
    "parameters": [
      {
        "name": "server_id",
        "in": "query",
        "required": false,
        "schema": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Server Id"
        }
      }
    ]
  }
},
"/api/mcp/tools/all": {
  "get": {
    "summary": "获取所有活跃MCP服务器的工具",
    "description": "获取所有活跃MCP服务器的工具，按服务器ID组织\n\nReturns:\n    Dict[str, Dict]: 按服务器ID组织的工具字典，每个服务器包含tools和error字段"
  }
}

？这两个函数似乎有点重叠，感觉像是新旧不同而已