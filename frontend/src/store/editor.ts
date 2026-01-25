import { createSlice, type PayloadAction, type Draft} from "@reduxjs/toolkit";

// 标签定义
interface Tab {
    id: string;
    content: string;
}

interface TabBar {
    tabs: Tab[];
    activeTabId: string | null;
}

export interface EditorState {
    tabBars: Record<string, TabBar>; // id → content
    activeTabBarId: string;
    backUp: Record<string, string>; // id → content，备份用的，主要功能是对比，显示脏数据情况，后续可能用于ai编辑操作
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

/**
 * 似乎没必要在删除标签时，清理备份内容
 * 保留下来，对我们的其他程序没有任何干扰
 * 因为没有操作会读取已经关闭的标签的备份数据
 * 而后续重新添加标签时，因为键名一致，重新添加标签会覆盖过时的备份
 */

/**
 * 同理
 * 标签栏，也没有必要关
 * 假如清空了一个标签栏的所有标签，但是偏要保留bar（如bar1,bar2,bar3），会怎样呢？
 * 没有任何问题
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
            const sourceTabBar = state.tabBars[state.activeTabBarId]!;
            const sourceTab = sourceTabBar.tabs.find(tab => tab.id === sourceTabId)!;

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

            if (!focusTabBar.tabs.find(tab => tab.id === id)) {
                focusTabBar.tabs.push({
                    id,
                    content
                });
                state.backUp[id] = content;
            }
        },
        // 从指定标签栏移除标签
        decreaseTab: (state: Draft<EditorState>, action: PayloadAction<{ tabId: string }>) => {
            const { tabId } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;

            const tabIndex = focusTabBar.tabs.findIndex(tab => tab.id === tabId);
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
                    focusTabBar.activeTabId = newActiveTab.id;
                } else {
                    focusTabBar.activeTabId = null;
                }
            }

            focusTabBar.tabs = focusTabBar.tabs.filter(tab => tab.id !== tabId);
        },
        // 设置活跃标签
        setActiveTab: (state: Draft<EditorState>, action: PayloadAction<{ tabId: string }>) => {
            const { tabId } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            focusTabBar.activeTabId = tabId;
        },
        // 更新标签内容
        updateTabContent: (state: Draft<EditorState>, action: PayloadAction<{ id: string; content: string }>) => {
            const { id, content } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            const tab = focusTabBar.tabs.find(tab => tab.id === id)!; // 本就是前端指名道姓要的tab id，不可能不存在
            tab.content = content;
        },
        // 保存标签内容（同步用户操作的contentA->备份保存的contentB）
        saveTabContent: (state: Draft<EditorState>, action: PayloadAction<{ id: string }>) => {
            const { id } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            const tab = focusTabBar.tabs.find(tab => tab.id === id)!;
            state.backUp[id] = tab.content
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
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            // 更新标签id
            const tab = focusTabBar.tabs.find(tab => tab.id === oldId)!;
            tab.id = newId;

            // 如果此id是活跃标签，更新activeTabId
            if (focusTabBar.activeTabId === oldId) {
                focusTabBar.activeTabId = newId;
            }
            // 更新备份数据中的标签id
            state.backUp[newId] = state.backUp[oldId]!; // 依旧逻辑问题，前端既然指名道姓，这个标签必定存在，否则根本不会显示在前端并被点击执行更新操作
            delete state.backUp[oldId];
        },

        // 关闭其他标签（仅限当前活跃标签栏）
        closeOtherTabs: (state: Draft<EditorState>, action: PayloadAction<{ tabId: string }>) => {
            const { tabId } = action.payload;
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            focusTabBar.tabs = focusTabBar.tabs.filter(tab => tab.id === tabId);
            focusTabBar.activeTabId = tabId;
        },
        // 关闭所有已保存标签
        closeSavedTabs: (state: Draft<EditorState>) => {
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            
            focusTabBar.tabs = focusTabBar.tabs.filter(tab => {
                const backUpContent = state.backUp[tab.id];
                return !( tab.content === backUpContent);
            });

            // 如果活跃标签被关闭，选择第一个标签
            if (focusTabBar.tabs.length > 0 && !focusTabBar.tabs.find(tab => tab.id === focusTabBar.activeTabId)) {
                const firstTab = focusTabBar.tabs[0]!;
                focusTabBar.activeTabId = firstTab.id;
            }
        },
        // 关闭所有标签
        closeAllTabs: (state: Draft<EditorState>) => {
            const focusTabBar = state.tabBars[state.activeTabBarId]!;
            focusTabBar.tabs = [];
            focusTabBar.activeTabId = null;
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
    closeAllTabs
} = tabSlice.actions;

export default tabSlice.reducer;

// 定义 RootState 类型
export interface RootState {
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