import sqlite3
from backend.config.config import settings

# 连接数据库
conn = sqlite3.connect(settings.CHECKPOINTS_DB_PATH)
cursor = conn.cursor()

# 获取所有表的结构
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()

print("数据库表结构:")
for table in tables:
    print(table[0])
    print()

# 获取一些示例数据
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
table_names = [row[0] for row in cursor.fetchall()]

for table_name in table_names:
    print(f"表 {table_name} 的示例数据:")
    cursor.execute(f"SELECT * FROM {table_name} LIMIT 2")
    rows = cursor.fetchall()
    
    # 获取列名
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [col[1] for col in cursor.fetchall()]
    print("列名:", columns)
    
    for row in rows:
        print("数据:", row)
    print()

# 关闭连接
conn.close()