import { createSlice } from "@reduxjs/toolkit";

const fileState = {
    collapsedChapters: {} // 管理文件夹展开/折叠状态，不存在或false应该为关闭
}

export const fileSlice = createSlice({
    name: 'fileSlice',
    initialState: fileState,
    reducers: {
        toggleCollapse: (state, action) => {
            const itemId = action.payload;
            state.collapsedChapters[itemId] = !state.collapsedChapters[itemId];
        },
        collapseAll: (state) => {
            state.collapsedChapters = {};
        }
    }
})

export const { toggleCollapse, collapseAll } = fileSlice.actions
export default fileSlice.reducer
