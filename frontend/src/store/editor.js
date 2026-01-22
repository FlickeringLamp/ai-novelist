import { createSlice } from "@reduxjs/toolkit";

const editorState = {
    tabs: [],
}

export const tabSlice = createSlice({
    name: 'tabSlice',
    initialState: editorState,
    reducers: {
        addTab: (state, action) => {
            const { id, content } = action.payload;
            if (!state.tabs.find(tab => tab.id === id)) {
                state.tabs.push({
                    id,
                    isActived: false,
                    content
                });
            }
        },
        decreaseTab: (state, action) => {
            const tabToRemove = action.payload;
            const tabIndex = state.tabs.findIndex(tab => tab.id === tabToRemove);
            
            if (tabIndex === -1) return;
            
            const isActiveTab = state.tabs[tabIndex].isActived;
            const activeTabCount = state.tabs.filter(tab => tab.isActived).length;
            
            // 如果关闭的是活跃标签，且活跃标签数量为1，才需要选择附近的标签作为新的活跃标签
            if (isActiveTab && activeTabCount === 1) {
                // 优先选择右边的标签，如果没有则选择左边的
                let newActiveIndex = -1;
                if (tabIndex < state.tabs.length - 1) {
                    newActiveIndex = tabIndex + 1;
                } else if (tabIndex > 0) {
                    newActiveIndex = tabIndex - 1;
                }
                
                // 设置新的活跃标签
                if (newActiveIndex !== -1) {
                    state.tabs[newActiveIndex].isActived = true;
                }
            }
            
            // 从 tabs 中移除标签
            state.tabs = state.tabs.filter(tab => tab.id !== tabToRemove);
        },
        exchangeActiveTab: (state, action) => {
            const [originalId, targetId] = action.payload;
            state.tabs.forEach(tab => {
                if (tab.id === originalId) {
                    tab.isActived = false;
                } else if (tab.id === targetId) {
                    tab.isActived = true;
                }
            });
        },
        addActiveTab: (state, action) => {
            const tabId = action.payload;
            const tab = state.tabs.find(tab => tab.id === tabId);
            if (tab) {
                tab.isActived = true;
            }
        },
        decreaseActiveTab: (state, action) => {
            const tabId = action.payload;
            const tab = state.tabs.find(tab => tab.id === tabId);
            if (tab) {
                tab.isActived = false;
            }
        },
        updateTabContent: (state, action) => {
            const { id, content } = action.payload;
            const tab = state.tabs.find(tab => tab.id === id);
            if (tab) {
                tab.content = content;
            }
        }
    }
})

export const { addTab, decreaseTab, exchangeActiveTab, addActiveTab, decreaseActiveTab, updateTabContent } = tabSlice.actions
export default tabSlice.reducer
