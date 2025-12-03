import sqlite3
import msgpack
from backend.config import settings

# 连接数据库
conn = sqlite3.connect(settings.CHECKPOINTS_DB_PATH)
cursor = conn.cursor()

# 获取最新的checkpoint数据
cursor.execute("""
    SELECT thread_id, checkpoint_id, checkpoint
    FROM checkpoints
    ORDER BY thread_id, checkpoint_id DESC
    LIMIT 1
""")
result = cursor.fetchone()

if result:
    thread_id, checkpoint_id, checkpoint_data = result
    print(f"线程ID: {thread_id}")
    print(f"检查点ID: {checkpoint_id}")
    
    # 解析msgpack数据
    try:
        checkpoint = msgpack.unpackb(checkpoint_data)
        print("\n检查点数据结构:")
        
        # 打印主要键
        for key in checkpoint.keys():
            print(f"- {key}")
        
        # 查看channel_values
        if 'channel_values' in checkpoint:
            channel_values = checkpoint['channel_values']
            print("\nchannel_values内容:")
            
            for key in channel_values.keys():
                print(f"- {key}")
                if key == 'messages':
                    messages = channel_values[key]
                    print(f"  消息数量: {len(messages)}")
                    
                    # 解析每条消息
                    for i, msg in enumerate(messages):
                        print(f"\n  消息 {i}:")
                        if hasattr(msg, 'code') and hasattr(msg, 'data'):
                            # 这是一个ExtType对象
                            try:
                                # 解包ExtType数据
                                msg_data = msgpack.unpackb(msg.data)
                                print(f"    消息类型: {msg_data[0]}")  # 第一个元素是消息类型
                                print(f"    消息类名: {msg_data[1]}")  # 第二个元素是类名
                                
                                # 第三个元素是消息内容字典
                                if len(msg_data) > 2 and isinstance(msg_data[2], dict):
                                    msg_content = msg_data[2]
                                    for key, value in msg_content.items():
                                        if key == 'content':
                                            # 截取内容的前100个字符
                                            content_preview = str(value)[:100] + "..." if len(str(value)) > 100 else value
                                            print(f"    {key}: {content_preview}")
                                        else:
                                            print(f"    {key}: {value}")
                            except Exception as e:
                                print(f"    解析ExtType失败: {e}")
                                print(f"    原始数据: {msg}")
                        elif isinstance(msg, dict):
                            for msg_key, msg_value in msg.items():
                                if msg_key == 'content':
                                    # 截取内容的前100个字符
                                    content_preview = str(msg_value)[:100] + "..." if len(str(msg_value)) > 100 else msg_value
                                    print(f"    {msg_key}: {content_preview}")
                                else:
                                    print(f"    {msg_key}: {msg_value}")
                        else:
                            print(f"    原始数据: {msg}")
                        
        # 查看writes表中的消息数据
        print("\n\n从writes表获取的消息数据:")
        cursor.execute("""
            SELECT task_id, idx, channel, type, value
            FROM writes
            WHERE thread_id = ? AND checkpoint_id = ?
            ORDER BY idx
        """, (thread_id, checkpoint_id))
        
        writes = cursor.fetchall()
        for write in writes:
            task_id, idx, channel, type, value = write
            print(f"\n写入记录 {idx}:")
            print(f"  任务ID: {task_id}")
            print(f"  通道: {channel}")
            print(f"  类型: {type}")
            
            if channel == 'messages' and value:
                try:
                    msg_data = msgpack.unpackb(value)
                    print(f"  消息数据: {msg_data}")
                    
                    # 尝试解析消息内容
                    if isinstance(msg_data, list) and len(msg_data) > 0:
                        msg = msg_data[0]
                        if isinstance(msg, dict):
                            content = msg.get('content', '')
                            msg_type = msg.get('type', '')
                            print(f"  消息类型: {msg_type}")
                            print(f"  消息内容: {content}")
                except Exception as e:
                    print(f"  解析消息失败: {e}")
                    
    except Exception as e:
        print(f"解析checkpoint数据失败: {e}")
        
else:
    print("没有找到checkpoint数据")

# 关闭连接
conn.close()