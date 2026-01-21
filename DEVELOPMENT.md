# 开发规范

本文档记录项目的开发规范和约定，本人与协作者应遵循这些规则。（2026/1/8更新）

## 后端开发规范

### 1. 导入

**规则：后端统一使用绝对导入**

所有后端模块应使用绝对导入方式，而非相对导入。

**示例：**

```python
# ✅ 正确 - 使用绝对导入
from backend.config import settings
from backend.core.ai_agent.core.graph_builder import GraphBuilder

# ❌ 错误 - 使用相对导入
from ..config import settings
from .core.graph_builder import GraphBuilder
```

**原因：**
- 提高代码可读性，明确模块层级关系
- 避免因文件移动导致的导入错误
- 便于IDE进行代码跳转和重构

### 2. 配置文件访问

**规则：原则上，config.py外的任何文件不允许直接访问store.json配置文件，只能通过config.py提供的settings类方法间接操作**

所有配置读取和修改操作必须通过 [`backend/config.py`](backend/config.py) 中提供的 `settings` 类方法进行。

**示例：**

```python
# ✅ 正确 - 通过settings类访问配置
from backend.config import settings

# 读取配置
api_key = settings.get_config('mode')

# ❌ 错误 - 直接访问store.json
import json
with open('backend/data/config/store.json', 'r') as f:
    config = json.load(f)
    api_key = config['openai']['api_key']
```

**原因：**
- 统一配置管理入口，便于维护
- 便于未来切换配置存储方式（如从文件切换到数据库）
- 避免配置文件被意外破坏

## 其他规范

（待补充）