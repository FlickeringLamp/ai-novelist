# ContextMenu 菜单位置调整问题记录

## 问题描述

在实现右键菜单自动调整位置功能时，`getBoundingClientRect()` 获取的尺寸不稳定，导致菜单位置判断时好时坏。

## 现象

同一个位置右键点击，输出结果不一致：

```
第一次：
y: 994
判断： true
rect.bottom: 1145
windowHeight: 1066

第二次：
y: 994
判断： false
rect.bottom: 994
windowHeight: 1066
```

## 分析

问题可能原因：

1. **DOM 渲染时序问题**：`useEffect` 执行时 DOM 可能还未完全渲染，导致 `getBoundingClientRect()` 测量的是未渲染完成的尺寸
2. **样式计算延迟**：Tailwind CSS 的类名可能还未完全应用
3. **React 渲染周期**：组件可能在测量后又重新渲染，导致实际位置与测量时不同

## 尝试的解决方案

### 方案 1：延迟测量
使用 `requestAnimationFrame` 延迟测量，等 DOM 布局完成后再获取尺寸
- 结果：效果不稳定，问题依然存在

### 方案 2：预估高度
放弃动态测量，改为根据点击位置预估展开方向
- 点击位置在屏幕上半部分 → 向下展开
- 点击位置在屏幕下半部分 → 向上展开

## 最终方案

采用简单的位置判断策略，不再依赖 `getBoundingClientRect()`：

```javascript
const windowHeight = window.innerHeight;
const windowMiddle = windowHeight / 2;

if (y > windowMiddle) {
  // 在屏幕下半部分，向上展开
  setAdjustedY(y - 预估高度);
} else {
  // 在屏幕上半部分，向下展开
  setAdjustedY(y);
}
```

## 经验总结

- `getBoundingClientRect()` 在 React 的 `useEffect` 中可能获取不到真实尺寸
- 对于位置敏感的 UI 组件，简单可靠的策略往往比精确测量更实用
- 如果需要精确测量，可能需要使用 `ResizeObserver` 或在 `useLayoutEffect` 中处理


————————
其他遇到的问题：

y: 998
ContextMenu.tsx:94 判断： false
ContextMenu.tsx:95 rect.bottom 152
ContextMenu.tsx:96 windowHeight 1066

这个是第一次右键时碰到的问题
bottom计算完全错误，大概是渲染问题
总之依赖渲染后计算很不稳定，故选择最笨的方式