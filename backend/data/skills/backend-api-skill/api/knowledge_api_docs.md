"/api/knowledge/bases": {
  "post": {
    "summary": "添加知识库",
    "description": "添加新的知识库\n\n- **id**: 知识库ID（由前端生成，格式为db_随机数）\n- **name**: 知识库名称\n- **provider**: 模型提供商ID\n- **model**: 嵌入模型名\n- **dimensions**: 嵌入维度\n- **chunkSize**: 分段大小\n- **overlapSize**: 重叠大小\n- **similarity**: 相似度\n- **returnDocs**: 返回文档片段数",
    "requestBody": {
      "content": {
        "application/json": {
          "schema": {
            "properties": {
              "id": {
                "type": "string",
                "title": "Id",
                "description": "知识库ID（db_随机数）"
              },
              "name": {
                "type": "string",
                "title": "Name",
                "description": "知识库名称"
              },
              "provider": {
                "type": "string",
                "title": "Provider",
                "description": "模型提供商ID"
              },
              "model": {
                "type": "string",
                "title": "Model",
                "description": "嵌入模型名"
              },
              "dimensions": {
                "type": "integer",
                "title": "Dimensions",
                "description": "嵌入维度"
              },
              "chunkSize": {
                "type": "integer",
                "title": "Chunksize",
                "description": "分段大小"
              },
              "overlapSize": {
                "type": "integer",
                "title": "Overlapsize",
                "description": "重叠大小"
              },
              "similarity": {
                "type": "number",
                "title": "Similarity",
                "description": "相似度"
              },
              "returnDocs": {
                "type": "integer",
                "title": "Returndocs",
                "description": "返回文档片段数"
              }
            },
            "type": "object",
            "required": [
              "id",
              "name",
              "provider",
              "model",
              "dimensions",
              "chunkSize",
              "overlapSize",
              "similarity",
              "returnDocs"
            ],
            "title": "AddKnowledgeBaseRequest",
            "description": "添加知识库请求"
          }
        }
      },
      "required": true
    }
  }
},
"/api/knowledge/bases/{kb_id}": {
  "put": {
    "summary": "更新知识库",
    "description": "更新指定知识库\n\n- **kb_id**: 知识库ID（路径参数）\n- **name**: 知识库名称（可选）\n- **provider**: 模型提供商ID（可选）\n- **model**: 嵌入模型名（可选）\n- **chunkSize**: 分段大小（可选）\n- **overlapSize**: 重叠大小（可选）\n- **similarity**: 相似度（可选）\n- **returnDocs**: 返回文档片段数（可选）",
    "parameters": [
      {
        "name": "kb_id",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "title": "Kb Id"
        }
      }
    ],
    "requestBody": {
      "required": true,
      "content": {
        "application/json": {
          "schema": {
            "properties": {
              "name": {
                "type": "string",
                "title": "Name",
                "description": "知识库名称"
              },
              "provider": {
                "type": "string",
                "title": "Provider",
                "description": "模型提供商ID"
              },
              "model": {
                "type": "string",
                "title": "Model",
                "description": "嵌入模型名"
              },
              "chunkSize": {
                "type": "integer",
                "title": "Chunksize",
                "description": "分段大小"
              },
              "overlapSize": {
                "type": "integer",
                "title": "Overlapsize",
                "description": "重叠大小"
              },
              "similarity": {
                "type": "number",
                "title": "Similarity",
                "description": "相似度"
              },
              "returnDocs": {
                "type": "integer",
                "title": "Returndocs",
                "description": "返回文档片段数"
              }
            },
            "type": "object",
            "title": "UpdateKnowledgeBaseRequest",
            "description": "更新知识库请求"
          }
        }
      }
    }
  },
  "delete": {
    "summary": "删除知识库",
    "description": "删除指定知识库（同时删除向量集合）\n\n- **kb_id**: 知识库ID（路径参数）",
    "parameters": [
      {
        "name": "kb_id",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "title": "Kb Id"
        }
      }
    ]
  }
},
"/api/knowledge/bases/{kb_id}/files": {
  "post": {
    "summary": "上传文件到知识库",
    "description": "上传文件到指定知识库，并进行嵌入处理（异步）\n\n- **kb_id**: 知识库ID（路径参数）\n- **file**: 要上传的文件\n\nReturns:\n    Dict: 操作结果",
    "parameters": [
      {
        "name": "kb_id",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "title": "Kb Id"
        }
      }
    ],
    "requestBody": {
      "required": true,
      "content": {
        "multipart/form-data": {
          "schema": {
            "properties": {
              "file": {
                "type": "string",
                "format": "binary",
                "title": "File",
                "description": "要上传的文件"
              }
            },
            "type": "object",
            "required": [
              "file"
            ],
            "title": "Body_upload_file_to_knowledge_base_api_knowledge_bases__kb_id__files_post"
          }
        }
      }
    }
  }
},
"/api/knowledge/bases/{kb_id}/files/{filename}": {
  "delete": {
    "summary": "从知识库删除文件",
    "description": "从指定知识库中删除文件及其所有向量\n\n- **kb_id**: 知识库ID（路径参数）\n- **filename**: 要删除的文件名（路径参数）\n\nReturns:\n    Dict: 操作结果",
    "parameters": [
      {
        "name": "kb_id",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "title": "Kb Id"
        }
      },
      {
        "name": "filename",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "title": "Filename"
        }
      }
    ]
  }
}