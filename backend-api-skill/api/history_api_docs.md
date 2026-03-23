"/api/history/checkpoints": {
  "post": {
    "summary": "获取指定会话id的存档点列表",
    "description": "获取指定会话的所有存档点列表\n\n- **thread_id**: 会话ID",
    "requestBody": {
      "content": {
        "application/json": {
          "schema": {
            "properties": {
              "thread_id": {
                "type": "string",
                "title": "Thread Id",
                "description": "会话ID",
                "default": "default"
              }
            },
            "type": "object",
            "title": "GetCheckpointsRequest",
            "description": "获取存档点列表请求"
          }
        }
      },
      "required": true
    }
  }
},
"/api/history/messages/operation": {
  "post": {
    "summary": "操作历史消息",
    "description": "对历史消息进行删除操作\n\n- **thread_id**: 会话ID\n- **target_ids**: 目标消息ID列表（可选，未传则删除全部）",
    "requestBody": {
      "content": {
        "application/json": {
          "schema": {
            "properties": {
              "thread_id": {
                "type": "string",
                "title": "Thread Id",
                "description": "会话ID",
                "default": "default"
              },
              "target_ids": {
                "anyOf": [
                  {
                    "items": {
                      "type": "string"
                    },
                    "type": "array"
                  },
                  {
                    "type": "null"
                  }
                ],
                "title": "Target Ids",
                "description": "目标消息ID列表（可选，未传则删除全部）"
              }
            },
            "type": "object",
            "title": "OperateMessagesRequest",
            "description": "操作历史消息请求"
          }
        }
      },
      "required": true
    }
  }
},
"/api/history/summarize": {
  "post": {
    "summary": "总结对话历史",
    "description": "总结对话历史\n\n- **thread_id**: 会话ID",
    "requestBody": {
      "content": {
        "application/json": {
          "schema": {
            "properties": {
              "thread_id": {
                "type": "string",
                "title": "Thread Id",
                "description": "会话ID",
                "default": "default"
              }
            },
            "type": "object",
            "title": "SummarizeRequest",
            "description": "总结对话请求"
          }
        }
      },
      "required": true
    }
  }
}