# 开发规范

本文档记录项目的开发规范和约定，本人与协作者应遵循这些规则。（2026/1/8更新）

## 后端开发规范

### 1. 导入规范

**规则：本项目严格使用绝对导入，禁止相对导入。**

#### ✅ 正确的导入方式

```python
# 导入标准库
import os
import sys

# 导入第三方库
import numpy as np

# 导入本项目模块 - 必须使用绝对路径
from backend.config.config import settings
from backend.ai_agent.core.graph_builder import GraphBuilder
from backend.api.chat_api import router
```

#### ❌ 禁止的导入方式

```python
# 禁止相对导入
from ..utils import helpers  # 不允许
from .submodule import func  # 不允许
```

#### PyCharm 用户注意事项

PyCharm 可能会自动将导入重构为通过 `__init__.py` 简化导入，这是允许的。

**原因：**
- 提高代码可读性，明确模块层级关系
- 避免因文件移动导致的导入错误
- 便于IDE进行代码跳转和重构

### 2. 配置文件访问

**规则：原则上，config.py外的任何文件不允许直接访问store.json配置文件，只能通过config.py提供的settings类方法间接操作**

所有配置读取和修改操作必须通过 [`backend/config.py`](backend/config/config.py) 中提供的 `settings` 类方法进行。

**示例：**

```python
# ✅ 正确 - 通过settings类访问配置
from backend.config.config import settings

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

## 前端规范：
统一使用定义的theme颜色，如text-theme-green

（待补充）