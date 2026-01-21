import { createSlice } from "@reduxjs/toolkit";

const tabState = {
    tabId: [],
    activeTabId: [],
}

export const tabSlice = createSlice({
    name: 'tabSlice',
    initialState: tabState,
    reducers: {
        addTab: (state, action) => {
            if (!state.tabId.includes(action.payload)){
                state.tabId.push(action.payload);
            }
        },
        decreaseTab: (state, action) => {
            const tabToRemove = action.payload;
            const isActiveTab = state.activeTabId.includes(tabToRemove);
            
            // 如果关闭的是活跃标签，需要选择附近的标签作为新的活跃标签
            if (isActiveTab) {
                const currentIndex = state.tabId.indexOf(tabToRemove);
                
                // 优先选择右边的标签，如果没有则选择左边的
                let newActiveTab = null;
                if (currentIndex < state.tabId.length - 1) {
                    newActiveTab = state.tabId[currentIndex + 1];
                } else if (currentIndex > 0) {
                    newActiveTab = state.tabId[currentIndex - 1];
                }
                
                // 设置新的活跃标签
                if (newActiveTab) {
                    state.activeTabId = [newActiveTab];
                } else {
                    // 没有可切换的标签，清空活跃标签
                    state.activeTabId = [];
                }
            }
            
            // 从 tabId 中移除标签
            state.tabId = state.tabId.filter(id => id !== action.payload);
        },
        setActiveTab: (state, action) =>{
            state.activeTabId = [action.payload]
        },
        addActiveTab: (state, action)=>{
            if (!state.activeTabId.includes(action.payload)){
                state.activeTabId.push(action.payload)
            }
        }
    }
})

export const { addTab, decreaseTab, setActiveTab, addActiveTab } = tabSlice.actions
export default tabSlice.reducer
