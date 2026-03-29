import asyncio
import logging
from typing import Optional
from backend.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

# 用于等待前端响应的 Future 对象
_pending_future: Optional[asyncio.Future] = None

# 超时时间（秒）
REQUEST_TIMEOUT = 2.0


async def request_tab_state() -> Optional[dict]:
    """
    请求前端标签栏状态
    
    发送请求并等待前端响应，带超时机制
    
    Returns:
        标签栏状态字典，超时或失败返回 None
        {
            "activeTabIds": [...],  # 活跃标签ID列表（去重）
            "allTabIds": [...]      # 所有标签ID列表（去重）
        }
    """
    global _pending_future
    
    if not ws_manager.is_connected():
        logger.debug("WebSocket 未连接，无法请求标签栏状态")
        return None
    
    # 创建新的 Future
    _pending_future = asyncio.get_event_loop().create_future()
    
    try:
        # 发送请求
        await ws_manager.send({
            "type": "request_tab_state",
            "payload": {}
        })
        
        # 等待响应（带超时）
        result = await asyncio.wait_for(_pending_future, timeout=REQUEST_TIMEOUT)
        return result
        
    except asyncio.TimeoutError:
        logger.debug("请求标签栏状态超时")
        return None
    except Exception as e:
        logger.error(f"请求标签栏状态失败: {e}")
        return None
    finally:
        _pending_future = None


@ws_manager.handler("tab_state_response")
async def handle_tab_state_response(payload: dict) -> None:
    """
    处理前端返回的标签栏状态
    
    消息格式:
    {
        "type": "tab_state_response",
        "payload": {
            "tabBars": {
                "bar1": {"tabs": ["file1.md", "file2.md"], "activeTabId": "file1.md"},
                "bar2": {"tabs": ["file3.md"], "activeTabId": "file3.md"}
            },
            "activeTabBarId": "bar1"
        }
    }
    """
    global _pending_future
    
    try:
        tab_bars = payload.get("tabBars", {})
        
        if not tab_bars:
            logger.debug("收到空的标签栏状态响应")
            if _pending_future and not _pending_future.done():
                _pending_future.set_result(None)
            return
        
        # 解析标签栏状态
        all_tabs = set()
        active_tabs = set()
        
        for bar_id, bar in tab_bars.items():
            tabs = bar.get("tabs", [])
            bar_active_tab = bar.get("activeTabId")
            
            all_tabs.update(tabs)
            if bar_active_tab:
                active_tabs.add(bar_active_tab)
        
        result = {
            "activeTabIds": sorted(list(active_tabs)),
            "allTabIds": sorted(list(all_tabs)),
            "tabCount": len(all_tabs)
        }
        
        logger.debug(f"收到标签栏状态: {result['tabCount']} 个标签")
        
        # 设置结果
        if _pending_future and not _pending_future.done():
            _pending_future.set_result(result)
        
    except Exception as e:
        logger.error(f"处理标签栏状态响应失败: {e}")
        if _pending_future and not _pending_future.done():
            _pending_future.set_result(None)


def format_tab_state_for_prompt(tab_state: Optional[dict]) -> str:
    """
    将标签栏状态格式化为提示词内容
    
    Args:
        tab_state: 标签栏状态字典
        
    Returns:
        格式化后的字符串，如果没有标签返回空字符串
    """
    if not tab_state:
        return ""
    
    all_tabs = tab_state.get("allTabIds", [])
    active_tabs = tab_state.get("activeTabIds", [])
    tab_count = tab_state.get("tabCount", 0)
    
    if tab_count == 0:
        return ""
    
    lines = []
    lines.append("【当前工作区标签状态】")
    
    # 活跃标签
    if active_tabs:
        lines.append(f"当前激活的文件: {', '.join(active_tabs)}")
    
    # 其他已打开的标签
    other_tabs = [t for t in all_tabs if t not in active_tabs]
    if other_tabs:
        lines.append(f"其他已打开的文件: {', '.join(other_tabs)}")
    
    return "\n".join(lines)


logger.info("标签栏状态处理器已注册（请求-响应模式）")
