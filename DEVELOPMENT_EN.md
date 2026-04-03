**English** | [中文](DEVELOPMENT.md)

# Development Standards

This document records the development standards and conventions of the project. All contributors should follow these rules. (Updated: 2026/2/9)

---

## Backend Development Standards

### 1. Import Standards

**Rule: This project strictly uses absolute imports; relative imports are prohibited.**

#### ✅ Correct Import Methods

```python
# Import standard libraries
import os
import sys

# Import third-party libraries
import numpy as np

# Import project modules - must use absolute paths
from backend.settings.settings import settings
from backend.ai_agent.core.graph_builder import GraphBuilder
from backend.api.chat_api import router
```

#### ❌ Prohibited Import Methods

```python
# Prohibit relative imports
from ..utils import helpers  # Not allowed
from .submodule import func  # Not allowed
```

#### PyCharm User Notes

PyCharm may automatically refactor imports through `__init__.py` to simplify them; this is allowed.

**Reasons:**
- Improve code readability and clarify module hierarchy
- Avoid import errors caused by file movement
- Facilitate IDE code navigation and refactoring

---

### 2. Configuration File Access

**Rule: In principle, any file outside of [`backend/settings/settings.py`](backend/settings/settings.py) is not allowed to directly access the `store.json`/`store.yaml` configuration files. Operations can only be performed indirectly through the `settings` class methods provided by `settings.py`.**

All configuration reading and modification operations must be performed through the `settings` class methods provided in [`backend/settings/settings.py`](backend/settings/settings.py).

#### Example:

```python
# ✅ Correct - Access configuration through settings class
from backend.settings.settings import settings

# Read configuration
api_key = settings.get_config('mode')

# ❌ Incorrect - Directly access store.json
import json

with open('backend/data/config/store.json', 'r') as f:
    config = json.load(f)
    api_key = config['openai']['api_key']
```

**Reasons:**
- Unified configuration management entry point for easier maintenance
- Facilitate future switching of configuration storage methods (e.g., from files to databases)
- Avoid accidental corruption of configuration files

---

## Frontend Standards

Unified use of defined theme colors, such as `text-theme-green`

(To be supplemented)
