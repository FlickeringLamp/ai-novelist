# 这是你必须遵守的开发规范
1. 后端导入，一概使用绝对导入
2. 前端类型一概放在types/
3. 重构时不要兼容任何旧的逻辑，除了加速代码腐化以外，没有任何用处
4. 所有配置读取和修改操作必须通过 [`backend/config.py`](backend/settings/config.py) 中提供的 `settings` 类方法进行。
其他详见DEVELOPMENT.md