# ChromaDB 相似度分数负数问题

## 问题描述

在使用 LangChain 的 Chroma 向量存储时，调用 `similarity_search_with_relevance_scores()` 或 `asimilarity_search_with_relevance_scores()` 方法时出现警告：

```
UserWarning: Relevance scores must be between 0 and 1, got [..., -0.003722392546211095, ...]
WARNING - No relevant docs were retrieved using the relevance score threshold 0.1
```

### 症状

1. 相似度分数为负数（如 -0.0037, -0.0162, -0.0364）
2. 设置的阈值（如 0.1）无法匹配任何文档
3. 检索结果为空

## 根本原因

ChromaDB 默认使用欧几里得距离（L2）进行向量搜索，而不是余弦相似度。这导致返回的分数可能为负数，不符合 LangChain 的 `similarity_search_with_relevance_scores` 方法期望的 [0, 1] 范围。

### 余弦相似度 vs 欧几里得距离

| 度量方式 | 范围 | 含义 |
|---------|------|------|
| 余弦相似度 | [0, 1] | 0 = 不相关，1 = 完全相同 |
| 欧几里得距离 | [0, ∞] | 0 = 完全相同，值越大越不相关 |
| 原始余弦相似度 | [-1, 1] | -1 = 完全相反，0 = 不相关，1 = 完全相同 |

## 解决方案 设置 collection_metadata

在创建 Chroma 向量存储时，明确指定使用余弦空间：

```python
from langchain_chroma import Chroma

vector_store = Chroma(
    collection_name=collection_name,
    embedding_function=embeddings,
    persist_directory=DB_PATH,
    collection_metadata={"hnsw:space": "cosine"}  # 指定使用余弦空间
)
```

tip: 已存在的集合无法修改元数据，需要重新创建

## 相关资源

- [GitHub Issue #10864](https://github.com/langchain-ai/langchain/issues/10864)
- [ChromaDB 文档](https://docs.trychroma.com/)
- [LangChain 向量存储文档](https://python.langchain.com/docs/modules/data_connection/vectorstores/)

## 总结

通过在创建 Chroma 向量存储时添加 `collection_metadata={"hnsw:space": "cosine"}` 参数，可以确保返回的相似度分数在 [0, 1] 范围内，避免负数问题，使阈值过滤正常工作。
