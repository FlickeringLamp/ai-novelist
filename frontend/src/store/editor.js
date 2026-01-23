import TabBar from "@/components/editor/TabBar";
import { createSlice } from "@reduxjs/toolkit";

const editorState = {
    tabBars: {
        // 使用对象存储，key 为 tabBarId
        bar1: {
            id: 'bar1',
            tabs: [], // 应该为标签id + 标签content，不再需要isActived
            activeTabId: null // 每个标签栏的活跃标签页有且只有一个
        }
    },
    activeTabBarId: 'bar1', // 当前活跃的标签栏.tabBarId应该自动生成tab1,tab2,tab3......，而不是等组件手动填入
    tabsB: {}, // B状态：备份数据，所有标签id + content，用于对比（在不同标签栏出现同一标签时，应该去重）
}

const autoCreateBarId =(state)=>{
    const baseName = "bar"
    let counter = 0
    while (true){
        counter += 1;
        const currentName = `${baseName}${counter}`;
        if (!state.tabBars[currentName]){
            return currentName;
        }
    }
};

export const tabSlice = createSlice({
    name: 'tabSlice',
    initialState: editorState,
    reducers: {
        // 添加标签到指定标签栏
        addTab: (state, action) => {
            const { id, content, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            if (!tabBar.tabs.find(tab => tab.id === id)) {
                tabBar.tabs.push({
                    id,
                    isActived: false,
                    content
                });
                state.tabsB[id] = {
                    id,
                    content
                };
            }
        },
        // 从指定标签栏移除标签
        decreaseTab: (state, action) => {
            const { tabId, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            const tabIndex = tabBar.tabs.findIndex(tab => tab.id === tabId);
            if (tabIndex === -1) return;
            
            const isActiveTab = tabBar.tabs[tabIndex].isActived;
            const activeTabCount = tabBar.tabs.filter(tab => tab.isActived).length;
            
            // 如果关闭的是活跃标签，且活跃标签数量为1，才需要选择附近的标签作为新的活跃标签
            if (isActiveTab && activeTabCount === 1) {
                // 优先选择右边的标签，如果没有则选择左边的
                let newActiveIndex = -1;
                if (tabIndex < tabBar.tabs.length - 1) {
                    newActiveIndex = tabIndex + 1;
                } else if (tabIndex > 0) {
                    newActiveIndex = tabIndex - 1;
                }
                
                // 设置新的活跃标签
                if (newActiveIndex !== -1) {
                    tabBar.tabs[newActiveIndex].isActived = true;
                    tabBar.activeTabId = tabBar.tabs[newActiveIndex].id;
                } else {
                    tabBar.activeTabId = null;
                }
            }
            
            tabBar.tabs = tabBar.tabs.filter(tab => tab.id !== tabId);
            delete state.tabsB[tabId];
        },
        // 交换活跃标签（只限同一个标签栏中）
        exchangeActiveTab: (state, action) => {
            const { originalId, targetId, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            tabBar.tabs.forEach(tab => {
                if (tab.id === originalId) {
                    tab.isActived = false;
                } else if (tab.id === targetId) {
                    tab.isActived = true;
                    tabBar.activeTabId = targetId;
                }
            });
        },
        // 设置活跃标签
        addActiveTab: (state, action) => {
            const { tabId, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            const tab = tabBar.tabs.find(tab => tab.id === tabId);
            if (tab) {
                tab.isActived = true;
                tabBar.activeTabId = tabId;
            }
        },
        // 取消活跃标签
        decreaseActiveTab: (state, action) => {
            const { tabId, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            const tab = tabBar.tabs.find(tab => tab.id === tabId);
            if (tab) {
                tab.isActived = false;
                if (tabBar.activeTabId === tabId) {
                    tabBar.activeTabId = null;
                }
            }
        },
        // 更新标签内容
        updateTabContent: (state, action) => {
            const { id, content, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            const tab = tabBar.tabs.find(tab => tab.id === id);
            if (tab) {
                tab.content = content;
            }
        },
        // 保存标签内容
        saveTabContent: (state, action) => {
            const { id, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            const tab = tabBar.tabs.find(tab => tab.id === id);
            if (tab) {
                state.tabsB[id] = {
                    id,
                    content: tab.content
                };
            }
        },
        // 重新排序标签
        reorderTabs: (state, action) => {
            const { fromIndex, toIndex, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            const [movedTab] = tabBar.tabs.splice(fromIndex, 1);
            tabBar.tabs.splice(toIndex, 0, movedTab);
        },
        // 更新标签ID
        updateTabId: (state, action) => {
            const { oldId, newId, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            // 更新tabs中的标签id
            const tab = tabBar.tabs.find(tab => tab.id === oldId);
            if (tab) {
                tab.id = newId;
            }
            // 更新tabsB中的标签id
            if (state.tabsB[oldId]) {
                state.tabsB[newId] = { ...state.tabsB[oldId], id: newId };
                delete state.tabsB[oldId];
            }
        },
        // 添加新标签栏（分屏）
        addTabBar: (state, action) => {
            const { sourceTabId } = action.payload;
            const sourceTabBar = state.tabBars[state.activeTabBarId];
            if (!sourceTabBar) return;
            
            // 找到源标签
            const sourceTab = sourceTabBar.tabs.find(tab => tab.id === sourceTabId);
            if (!sourceTab) return;
            
            // 创建新标签栏
            const tabBarId = autoCreateBarId(state)
            state.tabBars[tabBarId] = {
                id: tabBarId,
                tabs: [{
                    id: sourceTab.id,
                    isActived: true,
                    content: sourceTab.content
                }],
                activeTabId: sourceTab.id
            };
            
            // 设置为活跃标签栏
            state.activeTabBarId = tabBarId;
        },
        // 移除标签栏
        removeTabBar: (state, action) => {
            const { tabBarId } = action.payload;
            
            // 不允许移除最后一个标签栏
            const tabBarIds = Object.keys(state.tabBars);
            if (tabBarIds.length <= 1) return;
            
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            // 清理 tabsB
            tabBar.tabs.forEach(tab => {
                delete state.tabsB[tab.id];
            });
            
            // 移除标签栏
            delete state.tabBars[tabBarId];
            
            // 如果移除的是活跃标签栏，设置新的活跃标签栏
            if (state.activeTabBarId === tabBarId) {
                const newTabBarIds = Object.keys(state.tabBars);
                state.activeTabBarId = newTabBarIds[0];
            }
        },
        // 设置活跃标签栏
        setActiveTabBar: (state, action) => {
            const { tabBarId } = action.payload;
            if (state.tabBars[tabBarId]) {
                state.activeTabBarId = tabBarId;
            }
        },
        // 关闭其他标签
        closeOtherTabs: (state, action) => {
            const { tabId, tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            const tabsToClose = tabBar.tabs.filter(tab => tab.id !== tabId);
            tabsToClose.forEach(tab => {
                delete state.tabsB[tab.id];
            });
            
            tabBar.tabs = tabBar.tabs.filter(tab => tab.id === tabId);
            tabBar.activeTabId = tabId;
        },
        // 关闭已保存标签
        closeSavedTabs: (state, action) => {
            const { tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            const tabsToClose = tabBar.tabs.filter(tab => {
                const tabB = state.tabsB[tab.id];
                return tabB && tab.content === tabB.content;
            });
            
            tabsToClose.forEach(tab => {
                delete state.tabsB[tab.id];
            });
            
            tabBar.tabs = tabBar.tabs.filter(tab => {
                const tabB = state.tabsB[tab.id];
                return !(tabB && tab.content === tabB.content);
            });
            
            // 如果活跃标签被关闭，选择第一个标签
            if (tabBar.tabs.length > 0 && !tabBar.tabs.find(tab => tab.id === tabBar.activeTabId)) {
                tabBar.activeTabId = tabBar.tabs[0].id;
                tabBar.tabs[0].isActived = true;
            }
        },
        // 关闭所有标签
        closeAllTabs: (state, action) => {
            const { tabBarId = state.activeTabBarId } = action.payload;
            const tabBar = state.tabBars[tabBarId];
            if (!tabBar) return;
            
            tabBar.tabs.forEach(tab => {
                delete state.tabsB[tab.id];
            });
            
            tabBar.tabs = [];
            tabBar.activeTabId = null;
        },
    },
})
export const {
    addTab,
    decreaseTab,
    exchangeActiveTab,
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
} = tabSlice.actions
export default tabSlice.reducer

// Selector：返回指定标签栏的标签
export const getTabs = (state, tabBarId) => {
    const tabBar = state.tabSlice.tabBars[tabBarId];
    return tabBar ? tabBar.tabs : [];
};

// Selector：返回指定标签栏的活跃标签
export const getActiveTab = (state, tabBarId) => {
    const tabBar = state.tabSlice.tabBars[tabBarId];
    if (!tabBar || !tabBar.activeTabId) return null;
    return tabBar.tabs.find(tab => tab.id === tabBar.activeTabId) || null;
};

// Selector：返回所有脏数据的 tab id 集合
export const dirtyTabs = (state) => {
    const dirtyTabs = new Set();
    Object.values(state.tabSlice.tabBars).forEach(tabBar => {
        tabBar.tabs.forEach(tab => {
            const tabB = state.tabSlice.tabsB[tab.id];
            if (tabB && tab.content !== tabB.content) {
                dirtyTabs.add(tab.id);
            }
        });
    });
    return dirtyTabs;
};
