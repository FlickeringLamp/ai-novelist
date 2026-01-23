import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// 定义接口
interface Tab {
    id: string;
    content: string;
}

interface TabBar {
    tabs: Tab[];
    activeTabId: string | null;
}

interface EditorState {
    tabBars: Record<string, TabBar>; // id → content
    activeTabBarId: string | null;
    backUp: Record<string, string>; // id → content
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
    backUp: {}
};

// 自动生成标签栏ID
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

// 定义 Action Payload 类型
interface AddTabPayload {
    id: string;
    content: string;
}

interface DecreaseTabPayload {
    tabId: string;
}

interface ExchangeActiveTabPayload {
    originalId: string;
    targetId: string;
}

interface AddActiveTabPayload {
    tabId: string;
}

interface DecreaseActiveTabPayload {
    tabId: string;
}

interface UpdateTabContentPayload {
    id: string;
    content: string;
}

interface SaveTabContentPayload {
    id: string;
}

interface ReorderTabsPayload {
    fromIndex: number;
    toIndex: number;
}

interface UpdateTabIdPayload {
    oldId: string;
    newId: string;
}

interface AddTabBarPayload {
    sourceTabId: string;
}

interface RemoveTabBarPayload {
    tabBarId: string;
}

interface SetActiveTabBarPayload {
    tabBarId: string;
}

interface CloseOtherTabsPayload {
    tabId: string;
}

export const tabSlice = createSlice({
    name: 'tabSlice',
    initialState: editorState,
    reducers: {
        // 添加标签到指定标签栏
        addTab: (state, action: PayloadAction<AddTabPayload>) => {
            const { id, content } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            if (!tabBar.tabs.find(tab => tab.id === id)) {
                tabBar.tabs.push({
                    id,
                    content
                });
                state.backUp[id] = content;
            }
        },
        // 从指定标签栏移除标签
        decreaseTab: (state, action: PayloadAction<DecreaseTabPayload>) => {
            const { tabId } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            const tabIndex = tabBar.tabs.findIndex(tab => tab.id === tabId);
            if (tabIndex === -1) return;

            const isActiveTab = tabBar.activeTabId === tabId;

            // 如果关闭的是活跃标签，需要选择附近的标签作为新的活跃标签
            if (isActiveTab) {
                let newActiveIndex = -1;
                if (tabIndex < tabBar.tabs.length - 1) {
                    newActiveIndex = tabIndex + 1;
                } else if (tabIndex > 0) {
                    newActiveIndex = tabIndex - 1;
                }

                if (newActiveIndex !== -1) {
                    const newActiveTab = tabBar.tabs[newActiveIndex];
                    if (newActiveTab) {
                        tabBar.activeTabId = newActiveTab.id;
                    } else {
                        tabBar.activeTabId = null;
                    }
                } else {
                    tabBar.activeTabId = null;
                }
            }

            tabBar.tabs = tabBar.tabs.filter(tab => tab.id !== tabId);
            delete state.backUp[tabId];
        },
        // 设置活跃标签
        addActiveTab: (state, action: PayloadAction<AddActiveTabPayload>) => {
            const { tabId } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            const tab = tabBar.tabs.find(tab => tab.id === tabId);
            if (tab) {
                tabBar.activeTabId = tabId;
            }
        },
        // 取消活跃标签
        decreaseActiveTab: (state, action: PayloadAction<DecreaseActiveTabPayload>) => {
            const { tabId } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            if (tabBar.activeTabId === tabId) {
                tabBar.activeTabId = null;
            }
        },
        // 更新标签内容
        updateTabContent: (state, action: PayloadAction<UpdateTabContentPayload>) => {
            const { id, content } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            const tab = tabBar.tabs.find(tab => tab.id === id);
            if (tab) {
                tab.content = content;
            }
        },
        // 保存标签内容
        saveTabContent: (state, action: PayloadAction<SaveTabContentPayload>) => {
            const { id } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            const tab = tabBar.tabs.find(tab => tab.id === id);
            if (tab) {
                state.backUp[id] = tab.content
            }
        },
        // 重新排序标签
        reorderTabs: (state, action: PayloadAction<ReorderTabsPayload>) => {
            const { fromIndex, toIndex } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            const [movedTab] = tabBar.tabs.splice(fromIndex, 1);
            if (movedTab) {
                tabBar.tabs.splice(toIndex, 0, movedTab);
            }
        },
        // 更新标签ID
        updateTabId: (state, action: PayloadAction<UpdateTabIdPayload>) => {
            const { oldId, newId } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            // 更新tabs中的标签id
            const tab = tabBar.tabs.find(tab => tab.id === oldId);
            if (tab) {
                tab.id = newId;
            }
            // 更新activeTabId
            if (tabBar.activeTabId === oldId) {
                tabBar.activeTabId = newId;
            }
            // 更新tabsB中的标签id
            if (state.backUp[oldId]) {
                state.backUp[newId] = state.backUp[oldId];
                delete state.backUp[oldId];
            }
        },
        // 添加新标签栏（分屏）
        addTabBar: (state, action: PayloadAction<AddTabBarPayload>) => {
            const { sourceTabId } = action.payload;
            const sourceTabBar = state.tabBars[state.activeTabBarId!];
            if (!sourceTabBar) return;

            // 找到源标签
            const sourceTab = sourceTabBar.tabs.find(tab => tab.id === sourceTabId);
            if (!sourceTab) return;

            // 创建新标签栏
            const tabBarId = autoCreateBarId(state);
            state.tabBars[tabBarId] = {
                tabs: [{
                    id: sourceTab.id,
                    content: sourceTab.content
                }],
                activeTabId: sourceTab.id
            };

            // 设置为活跃标签栏
            state.activeTabBarId = tabBarId;
        },
        // 移除标签栏
        removeTabBar: (state, action: PayloadAction<RemoveTabBarPayload>) => {
            const { tabBarId } = action.payload;

            // 不允许移除最后一个标签栏
            const tabBarIds = Object.keys(state.tabBars);
            if (tabBarIds.length <= 1) return;

            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;

            // 清理 tabsB
            tabBar.tabs.forEach(tab => {
                delete state.backUp[tab.id];
            });

            // 移除标签栏
            delete state.tabBars[tabBarId];

            // 如果移除的是活跃标签栏，设置新的活跃标签栏
            if (state.activeTabBarId === tabBarId) {
                const newTabBarIds = Object.keys(state.tabBars);
                state.activeTabBarId = newTabBarIds[0] || null;
            }
        },
        // 设置活跃标签栏
        setActiveTabBar: (state, action: PayloadAction<SetActiveTabBarPayload>) => {
            const { tabBarId } = action.payload;
            if (state.tabBars[tabBarId]) {
                state.activeTabBarId = tabBarId;
            }
        },
        // 关闭其他标签
        closeOtherTabs: (state, action: PayloadAction<CloseOtherTabsPayload>) => {
            const { tabId } = action.payload;
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            const tabsToClose = tabBar.tabs.filter(tab => tab.id !== tabId);
            tabsToClose.forEach(tab => {
                delete state.backUp[tab.id];
            });

            tabBar.tabs = tabBar.tabs.filter(tab => tab.id === tabId);
            tabBar.activeTabId = tabId;
        },
        // 关闭已保存标签
        closeSavedTabs: (state) => {
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            const tabsToClose = tabBar.tabs.filter(tab => {
                const backUpContent = state.backUp[tab.id];
                return backUpContent && tab.content === backUpContent;
            });

            tabsToClose.forEach(tab => {
                delete state.backUp[tab.id];
            });

            tabBar.tabs = tabBar.tabs.filter(tab => {
                const backUpContent = state.backUp[tab.id];
                return !(backUpContent && tab.content === backUpContent);
            });

            // 如果活跃标签被关闭，选择第一个标签
            if (tabBar.tabs.length > 0 && !tabBar.tabs.find(tab => tab.id === tabBar.activeTabId)) {
                const firstTab = tabBar.tabs[0];
                if (firstTab) {
                    tabBar.activeTabId = firstTab.id;
                }
            }
        },
        // 关闭所有标签
        closeAllTabs: (state) => {
            const tabBar = state.tabBars[state.activeTabBarId!];
            if (!tabBar) return;

            tabBar.tabs.forEach(tab => {
                delete state.backUp[tab.id];
            });

            tabBar.tabs = [];
            tabBar.activeTabId = null;
        },
    },
});

export const {
    addTab,
    decreaseTab,
    addActiveTab,
    decreaseActiveTab,
    updateTabContent,
    saveTabContent,
    reorderTabs,
    updateTabId,
    addTabBar,
    removeTabBar,
    setActiveTabBar,
    closeOtherTabs,
    closeSavedTabs,
    closeAllTabs
} = tabSlice.actions;

export default tabSlice.reducer;

// 定义 RootState 类型
interface RootState {
    tabSlice: EditorState;
}

// Selector：返回指定标签栏的标签
export const getTabs = (state: RootState, tabBarId: string): Tab[] => {
    const tabBar = state.tabSlice.tabBars[tabBarId];
    return tabBar ? tabBar.tabs : [];
};

// Selector：返回指定标签栏的活跃标签
export const getActiveTab = (state: RootState, tabBarId: string): Tab | null => {
    const tabBar = state.tabSlice.tabBars[tabBarId];
    if (!tabBar || !tabBar.activeTabId) return null;
    return tabBar.tabs.find(tab => tab.id === tabBar.activeTabId) || null;
};

// Selector：返回所有脏数据的 tab id 集合
export const dirtyTabs = (state: RootState): Set<string> => {
    const dirtyTabs = new Set<string>();
    Object.values(state.tabSlice.tabBars).forEach(tabBar => {
        tabBar.tabs.forEach(tab => {
            const backUpContent = state.tabSlice.backUp[tab.id];
            if (backUpContent && tab.content !== backUpContent) {
                dirtyTabs.add(tab.id);
            }
        });
    });
    return dirtyTabs;
};

// Selector：返回指定标签栏
export const getTabBar = (state: RootState, tabBarId: string): TabBar | null => {
    return state.tabSlice.tabBars[tabBarId] || null;
};

// Selector：返回活跃标签栏
export const getActiveTabBar = (state: RootState): TabBar | null => {
    if (!state.tabSlice.activeTabBarId) return null;
    return state.tabSlice.tabBars[state.tabSlice.activeTabBarId] || null;
};

// Selector：返回所有标签栏
export const getAllTabBars = (state: RootState): TabBar[] => {
    return Object.values(state.tabSlice.tabBars);
};
