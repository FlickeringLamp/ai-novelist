import { createSlice, createSelector, type PayloadAction, type Draft} from "@reduxjs/toolkit";

export interface TabBar {
    tabs: string[];
    activeTabId: string | null;
}

export interface EditorState {
    tabBars: Record<string, TabBar>;
    activeTabBarId: string;
    currentData: Record<string, string>; // id → content，用户实时操作的数据
    backUp: Record<string, string>; // id → content，备份用的，主要功能是对比，显示脏数据情况，后续可能用于ai编辑操作
}

// 定义 RootState 类型
export interface RootState {
    tabSlice: EditorState;
}

// 声明使用（创建初始状态）
const editorState: EditorState = {
    tabBars: {
        bar1: {
            tabs: [],
            activeTabId: null
        }
    },
    activeTabBarId: 'bar1',
    currentData: {},
    backUp: {}
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
const cleanCurrentData = (state: Draft<EditorState>, tabIds: string[]): void => {
    tabIds.forEach(tabId => {
        const existsInAnyBar = Object.values(state.tabBars).some(tabBar =>
            tabBar.tabs.includes(tabId)
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
    name: 'tabSlice',
    initialState: editorState,
    reducers: {
        // 标签栏操作
        // 添加新标签栏（分屏，指定一个标签后向右拆分）
        addTabBar: (state: Draft<EditorState>, action: PayloadAction<{ sourceTabId: string }>) => {
            const { sourceTabId } = action.payload;

            // 创建新标签栏
            const newTabBarId = autoCreateBarId(state);
            state.tabBars[newTabBarId] = {
                tabs: [sourceTabId],
                activeTabId: sourceTabId
            };

            // 设置为活跃标签栏
            state.activeTabBarId = newTabBarId;
        },

        // 设置活跃标签栏，在具体组件中，任何标签操作，应该先用Bar的reducer，再使用Tab的reducer（如有）
        setActiveTabBar: (state: Draft<EditorState>, action: PayloadAction<{ tabBarId: string }>) => {
            const { tabBarId } = action.payload;
            state.activeTabBarId = tabBarId;
        },

        // 标签操作
        // 添加标签到指定标签栏
        addTab: (state: Draft<EditorState>, action: PayloadAction<{ id: string; content: string }>) => {
            const { id, content } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!; // 活跃标签栏有且必须只有一个，不可能为空

            if (!focusTabBar.tabs.find(tab => tab === id)) {
                focusTabBar.tabs.push(id);
                // 只有当id不存在于currentData时，才设置内容。避免在bar1中有脏状态，在bar2打开这个标签时，从后端获取的content直接刷掉了脏数据（备份数据需要在每次添加tab时更新，否则会沿用上次关闭tab时的旧content）
                if (!(state.currentData[id] !== undefined)) {
                    state.currentData[id] = content;
                    state.backUp[id] = content;
                }
            }
        },
        // 从指定标签栏移除标签
        decreaseTab: (state: Draft<EditorState>, action: PayloadAction<{ tabId: string }>) => {
            const { tabId } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;

            const tabIndex = focusTabBar.tabs.findIndex(tab => tab === tabId);
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

            focusTabBar.tabs = focusTabBar.tabs.filter(tab => tab !== tabId);

            // 清理currentData
            cleanCurrentData(state, [tabId]);
        },
        // 设置活跃标签
        setActiveTab: (state: Draft<EditorState>, action: PayloadAction<{ tabId: string }>) => {
            const { tabId } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            focusTabBar.activeTabId = tabId;
        },
        // 更新标签内容（实时刷新用户正在编辑的currentData）
        updateTabContent: (state: Draft<EditorState>, action: PayloadAction<{ id: string; content: string }>) => {
            const { id, content } = action.payload;
            state.currentData[id] = content;
        },
        // 保存标签内容（同步用户操作的contentA->备份保存的contentB）
        saveTabContent: (state: Draft<EditorState>, action: PayloadAction<{ id: string }>) => {
            const { id } = action.payload;
            state.backUp[id] = state.currentData[id]!;
        },
        // 重新排序标签
        reorderTabs: (state: Draft<EditorState>, action: PayloadAction<{ fromIndex: number; toIndex: number }>) => {
            const { fromIndex, toIndex } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            // 取出需要移动的Tab，并插入到目标位置
            const [movedTab] = focusTabBar.tabs.splice(fromIndex, 1);
            focusTabBar.tabs.splice(toIndex, 0, movedTab!);
        },
        // 更新标签ID
        updateTabId: (state: Draft<EditorState>, action: PayloadAction<{ oldId: string; newId: string }>) => {
            const { oldId, newId } = action.payload;
            // 遍历所有标签栏，更新匹配的标签id
            Object.values(state.tabBars).forEach(tabBar => {
                const tabIndex = tabBar.tabs.findIndex(tab => tab === oldId);
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
        closeOtherTabs: (state: Draft<EditorState>, action: PayloadAction<{ tabId: string }>) => {
            const { tabId } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            
            // 记录被关闭的标签
            const closedTabs = focusTabBar.tabs.filter(tab => tab !== tabId);
            
            focusTabBar.tabs = focusTabBar.tabs.filter(tab => tab === tabId);
            focusTabBar.activeTabId = tabId;
            
            // 清理被关闭标签的currentData
            cleanCurrentData(state, closedTabs);
        },
        // 关闭所有已保存标签
        closeSavedTabs: (state: Draft<EditorState>) => {
            const focusTabBar = state.tabBars[state.activeTabBarId]!;

            // 记录被关闭的标签
            const closedTabs = focusTabBar.tabs.filter(tab => {
                const backUpContent = state.backUp[tab];
                const currentContent = state.currentData[tab];
                return currentContent === backUpContent;
            });

            focusTabBar.tabs = focusTabBar.tabs.filter(tab => {
                const backUpContent = state.backUp[tab];
                const currentContent = state.currentData[tab];
                return !(currentContent === backUpContent);
            });

            // 如果活跃标签被关闭，选择第一个标签
            if (focusTabBar.tabs.length > 0 && !focusTabBar.tabs.find(tab => tab === focusTabBar.activeTabId)) {
                const firstTab = focusTabBar.tabs[0]!;
                focusTabBar.activeTabId = firstTab;
            }
            
            // 清理被关闭标签的currentData
            cleanCurrentData(state, closedTabs);
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
        },
        // 从所有标签栏中删除指定标签（用于文件删除时清理标签）
        deleteTabFromAllBars: (state: Draft<EditorState>, action: PayloadAction<{ tabId: string }>) => {
            const { tabId } = action.payload;
            
            // 遍历所有标签栏，删除该标签
            Object.values(state.tabBars).forEach(tabBar => {
                const tabIndex = tabBar.tabs.findIndex(tab => tab === tabId);
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
                    
                    tabBar.tabs = tabBar.tabs.filter(tab => tab !== tabId);
                }
            });
            
            // 清理currentData和backUp
            delete state.currentData[tabId];
            delete state.backUp[tabId];
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
    deleteTabFromAllBars
} = tabSlice.actions;

export default tabSlice.reducer;

// 各种Selector
// 返回所有脏数据的 tab id 集合
// 由于 "" && ... 会短路，内容不同，也不会被标记为脏数据，故应该使用!== undefined判断是否有值
export const dirtyTabs = createSelector(
    [(state: RootState) => state.tabSlice.tabBars, (state: RootState) => state.tabSlice.backUp, (state: RootState) => state.tabSlice.currentData],
    (tabBars, backUp, currentData): Set<string> => {
        const dirtyTabsSet = new Set<string>();
        Object.values(tabBars).forEach(tabBar => {
            tabBar.tabs.forEach(tab => {
                const backUpContent = backUp[tab];
                const currentContent = currentData[tab];
                if (backUpContent !== undefined && currentContent !== backUpContent) {
                    dirtyTabsSet.add(tab);
                }
            });
        });
        return dirtyTabsSet;
    }
);

// 返回有内容的标签栏（tabs数组不为空）
export const getTabBarsWithContent = createSelector(
    [(state: RootState) => state.tabSlice.tabBars],
    (tabBars): Record<string, TabBar> => {
        const result: Record<string, TabBar> = {};
        Object.entries(tabBars).forEach(([id, tabBar]) => {
            if (tabBar.tabs.length > 0) {
                result[id] = tabBar;
            }
        });
        return result;
    }
);
