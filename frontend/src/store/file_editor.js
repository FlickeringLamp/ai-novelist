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
            if (state.tabId.includes(action.payload)){
                state.tabId.filter(action.payload);
            }
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