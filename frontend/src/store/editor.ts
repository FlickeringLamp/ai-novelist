import {
  createSlice,
  createSelector,
  type PayloadAction,
  type Draft,
} from "@reduxjs/toolkit";
import type { TabBar, EditorState, EditorSliceRootState } from '../types';

/**
 * 这里详细讲解一下四个核心数据
 * 
 * 1. currentData,这是展示用的新值。
 * 主要用途有：
 * - 用户编辑时，可以配合backUp,计算脏状态
 * - AI编辑内容时，配合backUp,显示左右差异对比，兼计算脏状态
 * - 存档点差异对比视图中，存储新版本内容，与checkpointContent配合展示左右对比
 * 
 * 2.backUp，备份数据
 * 主要用途有：
 * - 用户编辑时，计算脏状态
 * - AI编辑内容时，左右对比，计算脏状态
 * - 在开启存档点差异对比视图时，默认与currentData相同
 * 
 * 3. checkpointContent,检查点数据（旧）
 * 主要用途：
 * - 配合currentData显示差异对比
 * 
 * 4. aiSuggestContent
 * 主要用途：
 * 在AI操作文件时的diff差异对比视图中，复制currentData,但后续不会同步currentData.
 * 用户编辑currentData完毕后，点击批准，计算AISuggestContent和currentData的diff差异，、
 * 发给后端，让后端保存currentData到磁盘的同时，将diff差异一并作为工具调用结果，发送给AI
 */

// 声明使用（创建初始状态）
const editorState: EditorState = {
  tabBars: {
    bar1: {
      tabs: [],
      activeTabId: null,
    },
  },
  activeTabBarId: "bar1",
  currentData: {},
  backUp: {},
  diffModeTabs: {},
  checkpointContent: {},
  checkpointPreviewTabs: {},
  aiSuggestContent: {},
};

// 其他给reducer用的辅助函数
// 自动生成新标签栏id
const autoCreateBarId = (state: EditorState): string => {
  const baseName = "bar";
  let counter = 0;
  while (true) {
    counter += 1;
    const currentName = `${baseName}${counter}`;
    if (!state.tabBars[currentName]) {
      return currentName;
    }
  }
};

// 清理currentData：检查标签是否还在任何bar中，如果不在则清理
const cleanCurrentData = (
  state: Draft<EditorState>,
  tabIds: string[],
): void => {
  tabIds.forEach((tabId) => {
    const existsInAnyBar = Object.values(state.tabBars).some((tabBar) =>
      tabBar.tabs.includes(tabId),
    );
    if (!existsInAnyBar) {
      delete state.currentData[tabId];
    }
  });
};

/**
 * 似乎没必要在删除标签时，清理备份内容
 * 保留下来，对我们的其他程序没有任何干扰
 * 因为没有操作会读取已经关闭的标签的备份数据
 * 而后续重新添加标签时，因为键名一致，重新添加标签会覆盖过时的备份
 *
 * 标签栏也没必要删
 * 假如清空了一个标签栏的所有标签，但是偏要保留bar（如bar1,bar2,bar3），会怎样呢？
 * 在显示上没有任何问题
 * 每次分屏都是创建一个新的标签栏
 * 只要前端检测到标签栏有内容再渲染，就没有任何视觉和使用时的干扰
 * 这样的话，各种移除标签栏的代码就是徒增代码复杂度，却没有实质的使用体验变化
 */

export const tabSlice = createSlice({
  name: "tabSlice",
  initialState: editorState,
  reducers: {
    // 标签栏操作
    // 添加新标签栏（分屏，指定一个标签后向右拆分）
    addTabBar: (
      state: Draft<EditorState>,
      action: PayloadAction<{ sourceTabId: string }>,
    ) => {
      const { sourceTabId } = action.payload;

      // 创建新标签栏
      const newTabBarId = autoCreateBarId(state);
      state.tabBars[newTabBarId] = {
        tabs: [sourceTabId],
        activeTabId: sourceTabId,
      };

      // 设置为活跃标签栏
      state.activeTabBarId = newTabBarId;
    },

    // 设置活跃标签栏，在具体组件中，任何标签操作，应该先用Bar的reducer，再使用Tab的reducer（如有）
    setActiveTabBar: (
      state: Draft<EditorState>,
      action: PayloadAction<{ tabBarId: string }>,
    ) => {
      const { tabBarId } = action.payload;
      state.activeTabBarId = tabBarId;
    },

    // 标签操作
    // 添加标签到指定标签栏
    addTab: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string; content: string }>,
    ) => {
      const { id, content } = action.payload;
      const focusTabBar = state.tabBars[state.activeTabBarId]!; // 活跃标签栏有且必须只有一个，不可能为空

      if (!focusTabBar.tabs.find((tab) => tab === id)) {
        focusTabBar.tabs.push(id);
        // 只有当id不存在于currentData时，才设置内容。避免在bar1中有脏状态，在bar2打开这个标签时，从后端获取的content直接刷掉了脏数据（备份数据需要在每次添加tab时更新，否则会沿用上次关闭tab时的旧content）
        if (!(state.currentData[id] !== undefined)) {
          state.currentData[id] = content;
          state.backUp[id] = content;
        }
      }
    },
    // 从指定标签栏移除标签
    decreaseTab: (
      state: Draft<EditorState>,
      action: PayloadAction<{ tabId: string }>,
    ) => {
      const { tabId } = action.payload;
      const focusTabBar = state.tabBars[state.activeTabBarId]!;

      const tabIndex = focusTabBar.tabs.findIndex((tab) => tab === tabId);
      if (tabIndex === -1) return;

      const isActiveTab = focusTabBar.activeTabId === tabId;

      // 如果关闭的是活跃标签，需要选择附近的标签作为新的活跃标签
      if (isActiveTab) {
        let newActiveIndex = -1;
        if (tabIndex < focusTabBar.tabs.length - 1) {
          newActiveIndex = tabIndex + 1;
        } else if (tabIndex > 0) {
          newActiveIndex = tabIndex - 1;
        }

        if (newActiveIndex !== -1) {
          const newActiveTab = focusTabBar.tabs[newActiveIndex]!;
          focusTabBar.activeTabId = newActiveTab;
        } else {
          focusTabBar.activeTabId = null;
        }
      }

      focusTabBar.tabs = focusTabBar.tabs.filter((tab) => tab !== tabId);

      // 清理currentData
      cleanCurrentData(state, [tabId]);
      
      // 如果是checkpoint预览标签，清理相关状态
      if (state.checkpointPreviewTabs[tabId]) {
        delete state.checkpointPreviewTabs[tabId];
        delete state.checkpointContent[tabId];
      }
      
      // 如果是差异模式标签，清理差异模式状态
      if (state.diffModeTabs[tabId]) {
        delete state.diffModeTabs[tabId];
      }
      
      // 清理AI建议内容
      delete state.aiSuggestContent[tabId];
    },
    // 设置活跃标签
    setActiveTab: (
      state: Draft<EditorState>,
      action: PayloadAction<{ tabId: string }>,
    ) => {
      const { tabId } = action.payload;
      const focusTabBar = state.tabBars[state.activeTabBarId]!;
      focusTabBar.activeTabId = tabId;
    },
    // 更新标签内容（实时刷新用户正在编辑的currentData）
    updateTabContent: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string; content: string }>,
    ) => {
      const { id, content } = action.payload;
      state.currentData[id] = content;
    },
    // 保存标签内容（同步用户操作的contentA->备份保存的contentB）
    saveTabContent: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string }>,
    ) => {
      const { id } = action.payload;
      state.backUp[id] = state.currentData[id]!;
    },
    // 更新备份内容（用于文件工具调用时缓存文件内容）
    updateBackUp: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string; content: string }>,
    ) => {
      const { id, content } = action.payload;
      state.backUp[id] = content;
    },
    // 重新排序标签
    reorderTabs: (
      state: Draft<EditorState>,
      action: PayloadAction<{ fromIndex: number; toIndex: number }>,
    ) => {
      const { fromIndex, toIndex } = action.payload;
      const focusTabBar = state.tabBars[state.activeTabBarId]!;
      // 取出需要移动的Tab，并插入到目标位置
      const [movedTab] = focusTabBar.tabs.splice(fromIndex, 1);
      focusTabBar.tabs.splice(toIndex, 0, movedTab!);
    },
    // 更新标签ID
    updateTabId: (
      state: Draft<EditorState>,
      action: PayloadAction<{ oldId: string; newId: string }>,
    ) => {
      const { oldId, newId } = action.payload;
      // 遍历所有标签栏，更新匹配的标签id
      Object.values(state.tabBars).forEach((tabBar) => {
        const tabIndex = tabBar.tabs.findIndex((tab) => tab === oldId);
        if (tabIndex !== -1) {
          tabBar.tabs[tabIndex] = newId;
        }

        // 如果此id是活跃标签，更新activeTabId
        if (tabBar.activeTabId === oldId) {
          tabBar.activeTabId = newId;
        }
      });
      // 更新currentData中的标签id
      state.currentData[newId] = state.currentData[oldId]!;
      delete state.currentData[oldId];
      // 更新备份数据中的标签id
      state.backUp[newId] = state.backUp[oldId]!;
      delete state.backUp[oldId];
    },

    // 关闭其他标签（仅限当前活跃标签栏）
    closeOtherTabs: (
      state: Draft<EditorState>,
      action: PayloadAction<{ tabId: string }>,
    ) => {
      const { tabId } = action.payload;
      const focusTabBar = state.tabBars[state.activeTabBarId]!;

      // 记录被关闭的标签
      const closedTabs = focusTabBar.tabs.filter((tab) => tab !== tabId);

      focusTabBar.tabs = focusTabBar.tabs.filter((tab) => tab === tabId);
      focusTabBar.activeTabId = tabId;

      // 清理被关闭标签的currentData
      cleanCurrentData(state, closedTabs);
      
      // 清理被关闭标签的checkpoint预览状态
      closedTabs.forEach(tabId => {
        if (state.checkpointPreviewTabs[tabId]) {
          delete state.checkpointPreviewTabs[tabId];
          delete state.checkpointContent[tabId];
        }
      });
      
      // 清理被关闭标签的差异模式状态
      closedTabs.forEach(tabId => {
        if (state.diffModeTabs[tabId]) {
          delete state.diffModeTabs[tabId];
        }
      });
      
      // 清理被关闭标签的AI建议内容
      closedTabs.forEach(tabId => {
        delete state.aiSuggestContent[tabId];
      });
    },
    // 关闭所有已保存标签
    closeSavedTabs: (state: Draft<EditorState>) => {
      const focusTabBar = state.tabBars[state.activeTabBarId]!;

      // 记录被关闭的标签
      const closedTabs = focusTabBar.tabs.filter((tab) => {
        const backUpContent = state.backUp[tab];
        const currentContent = state.currentData[tab];
        return currentContent === backUpContent;
      });

      focusTabBar.tabs = focusTabBar.tabs.filter((tab) => {
        const backUpContent = state.backUp[tab];
        const currentContent = state.currentData[tab];
        return !(currentContent === backUpContent);
      });

      // 如果活跃标签被关闭，选择第一个标签
      if (
        focusTabBar.tabs.length > 0 &&
        !focusTabBar.tabs.find((tab) => tab === focusTabBar.activeTabId)
      ) {
        const firstTab = focusTabBar.tabs[0]!;
        focusTabBar.activeTabId = firstTab;
      }

      // 清理被关闭标签的currentData
      cleanCurrentData(state, closedTabs);
      
      // 清理被关闭标签的checkpoint预览状态
      closedTabs.forEach(tabId => {
        if (state.checkpointPreviewTabs[tabId]) {
          delete state.checkpointPreviewTabs[tabId];
          delete state.checkpointContent[tabId];
        }
      });
      
      // 清理被关闭标签的差异模式状态
      closedTabs.forEach(tabId => {
        if (state.diffModeTabs[tabId]) {
          delete state.diffModeTabs[tabId];
        }
      });
      
      // 清理被关闭标签的AI建议内容
      closedTabs.forEach(tabId => {
        delete state.aiSuggestContent[tabId];
      });
    },
    // 关闭所有标签
    closeAllTabs: (state: Draft<EditorState>) => {
      const focusTabBar = state.tabBars[state.activeTabBarId]!;

      // 记录被关闭的标签
      const closedTabs = [...focusTabBar.tabs];

      focusTabBar.tabs = [];
      focusTabBar.activeTabId = null;

      // 清理被关闭标签的currentData
      cleanCurrentData(state, closedTabs);
      
      // 清理所有checkpoint预览状态
      closedTabs.forEach(tabId => {
        delete state.checkpointPreviewTabs[tabId];
        delete state.checkpointContent[tabId];
      });
      
      // 清理所有差异模式状态
      closedTabs.forEach(tabId => {
        delete state.diffModeTabs[tabId];
      });
      
      // 清理所有AI建议内容
      closedTabs.forEach(tabId => {
        delete state.aiSuggestContent[tabId];
      });
    },
    // 从所有标签栏中删除指定标签（用于文件删除时清理标签）
    deleteTabFromAllBars: (
      state: Draft<EditorState>,
      action: PayloadAction<{ tabId: string }>,
    ) => {
      const { tabId } = action.payload;

      // 遍历所有标签栏，删除该标签
      Object.values(state.tabBars).forEach((tabBar) => {
        const tabIndex = tabBar.tabs.findIndex((tab) => tab === tabId);
        if (tabIndex !== -1) {
          const isActiveTab = tabBar.activeTabId === tabId;

          // 如果删除的是活跃标签，需要选择附近的标签作为新的活跃标签
          if (isActiveTab) {
            let newActiveIndex = -1;
            if (tabIndex < tabBar.tabs.length - 1) {
              newActiveIndex = tabIndex + 1;
            } else if (tabIndex > 0) {
              newActiveIndex = tabIndex - 1;
            }

            if (newActiveIndex !== -1) {
              const newActiveTab = tabBar.tabs[newActiveIndex]!;
              tabBar.activeTabId = newActiveTab;
            } else {
              tabBar.activeTabId = null;
            }
          }

          tabBar.tabs = tabBar.tabs.filter((tab) => tab !== tabId);
        }
      });

      // 清理currentData和backUp
      delete state.currentData[tabId];
      delete state.backUp[tabId];
      
      // 清理checkpoint预览状态
      delete state.checkpointPreviewTabs[tabId];
      delete state.checkpointContent[tabId];
      
      // 清理差异模式状态
      delete state.diffModeTabs[tabId];
      
      // 清理AI建议内容
      delete state.aiSuggestContent[tabId];
    },
    // 创建临时标签用于差异对比（用于文件工具调用）
    createTempDiffTab: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string; originalContent: string; modifiedContent: string }>,
    ) => {
      const { id, originalContent, modifiedContent } = action.payload;

      // 使用当前活跃的标签栏，确保文件创建在用户正在使用的标签栏
      const targetTabBarId = state.activeTabBarId;

      if (targetTabBarId) {
        const targetTabBar = state.tabBars[targetTabBarId]!;
        
        // 如果标签不存在，则添加
        if (!targetTabBar.tabs.find((tab) => tab === id)) {
          targetTabBar.tabs.push(id);
        }
        
        // 设置为活跃标签
        targetTabBar.activeTabId = id;
        
        // 设置活跃标签栏
        state.activeTabBarId = targetTabBarId;
      }

      // 设置backUp为原内容，currentData为修改后的内容
      state.backUp[id] = originalContent;
      state.currentData[id] = modifiedContent;
      
      // 添加到差异模式标签集合
      state.diffModeTabs[id] = true;
    },
    // 更新差异模式标签的内容（流式更新）
    updateDiffTabContent: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string; content: string }>,
    ) => {
      const { id, content } = action.payload;
      state.currentData[id] = content;
    },
    // 退出差异模式
    exitDiffMode: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string }>,
    ) => {
      const { id } = action.payload;
      delete state.diffModeTabs[id];
    },
    // 设置存档点预览（用于存档面板查看历史版本差异）
    setCheckpointPreview: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string; checkpointContent: string; currentContent: string }>,
    ) => {
      const { id, checkpointContent: oldContent, currentContent } = action.payload;

      // 使用当前活跃的标签栏
      const targetTabBarId = state.activeTabBarId;
      const targetTabBar = state.tabBars[targetTabBarId]!;

      // 如果标签不存在，则添加
      if (!targetTabBar.tabs.find((tab) => tab === id)) {
        targetTabBar.tabs.push(id);
      }

      // 设置为活跃标签
      targetTabBar.activeTabId = id;

      // 存档预览模式：对比 旧版本(checkpointContent) vs 新版本(backUp/currentData)
      // - checkpointContent: 旧版本（前一个检查点的内容）
      // - backUp/currentData: 新版本（后一个检查点的内容）
      // - 由于最新内容和最新提交之间，无法直接比较两个检查点之间的差异，所以单独讨论
      state.checkpointContent[id] = oldContent;
      state.backUp[id] = currentContent;
      state.currentData[id] = currentContent;

      // 添加到存档预览标签集合
      state.checkpointPreviewTabs[id] = true;
    },
    // 退出存档点预览模式
    exitCheckpointPreview: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string }>,
    ) => {
      const { id } = action.payload;
      delete state.checkpointPreviewTabs[id];
      delete state.checkpointContent[id];
    },
    // 设置AI建议内容（初始化AI编辑时的建议内容快照）
    setAiSuggestContent: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string; content: string }>,
    ) => {
      const { id, content } = action.payload;
      state.aiSuggestContent[id] = content;
    },
    // 清除AI建议内容
    clearAiSuggestContent: (
      state: Draft<EditorState>,
      action: PayloadAction<{ id: string }>,
    ) => {
      const { id } = action.payload;
      delete state.aiSuggestContent[id];
    },
  },
});

export const {
  addTab,
  decreaseTab,
  setActiveTab,
  updateTabContent,
  saveTabContent,
  reorderTabs,
  updateTabId,
  addTabBar,
  setActiveTabBar,
  closeOtherTabs,
  closeSavedTabs,
  closeAllTabs,
  deleteTabFromAllBars,
  createTempDiffTab,
  updateDiffTabContent,
  exitDiffMode,
  updateBackUp,
  setCheckpointPreview,
  exitCheckpointPreview,
  setAiSuggestContent,
  clearAiSuggestContent,
} = tabSlice.actions;

export default tabSlice.reducer;

// 各种Selector
// 返回所有脏数据的 tab id 集合
// 由于 "" && ... 会短路，内容不同，也不会被标记为脏数据，故应该使用!== undefined判断是否有值
export const dirtyTabs = createSelector(
  [
    (state: EditorSliceRootState) => state.tabSlice.tabBars,
    (state: EditorSliceRootState) => state.tabSlice.backUp,
    (state: EditorSliceRootState) => state.tabSlice.currentData,
  ],
  (tabBars, backUp, currentData): Set<string> => {
    const dirtyTabsSet = new Set<string>();
    Object.values(tabBars).forEach((tabBar) => {
      tabBar.tabs.forEach((tab) => {
        const backUpContent = backUp[tab];
        const currentContent = currentData[tab];
        if (backUpContent !== undefined && currentContent !== backUpContent) {
          dirtyTabsSet.add(tab);
        }
      });
    });
    return dirtyTabsSet;
  },
);

// 返回有内容的标签栏（tabs数组不为空）
export const getTabBarsWithContent = createSelector(
  [(state: EditorSliceRootState) => state.tabSlice.tabBars],
  (tabBars): Record<string, TabBar> => {
    const result: Record<string, TabBar> = {};
    Object.entries(tabBars).forEach(([id, tabBar]) => {
      if (tabBar.tabs.length > 0) {
        result[id] = tabBar;
      }
    });
    return result;
  },
);

// 返回指定标签是否处于差异模式
export const isTabInDiffMode = createSelector(
  [(state: EditorSliceRootState) => state.tabSlice.diffModeTabs, (_: EditorSliceRootState, tabId: string) => tabId],
  (diffModeTabs, tabId): boolean => {
    return diffModeTabs[tabId] || false;
  },
);

// 返回指定标签是否处于存档点预览模式
export const isTabInCheckpointPreview = createSelector(
  [(state: EditorSliceRootState) => state.tabSlice.checkpointPreviewTabs, (_: EditorSliceRootState, tabId: string) => tabId],
  (checkpointPreviewTabs, tabId): boolean => {
    return checkpointPreviewTabs[tabId] || false;
  },
);

// 返回指定标签的存档点内容（用于左侧显示）
export const getCheckpointContent = createSelector(
  [(state: EditorSliceRootState) => state.tabSlice.checkpointContent, (_: EditorSliceRootState, tabId: string) => tabId],
  (checkpointContent, tabId): string => {
    return checkpointContent[tabId] || '';
  },
);

// 返回指定标签的AI建议内容
export const getAiSuggestContent = createSelector(
  [(state: EditorSliceRootState) => state.tabSlice.aiSuggestContent, (_: EditorSliceRootState, tabId: string) => tabId],
  (aiSuggestContent, tabId): string => {
    return aiSuggestContent[tabId] || '';
  },
);

// 返回指定标签是否存在AI建议内容
export const hasAiSuggestContent = createSelector(
  [(state: EditorSliceRootState) => state.tabSlice.aiSuggestContent, (_: EditorSliceRootState, tabId: string) => tabId],
  (aiSuggestContent, tabId): boolean => {
    return tabId in aiSuggestContent;
  },
);
