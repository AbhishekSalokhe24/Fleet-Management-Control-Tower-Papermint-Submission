import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedRobotId: null,
  searchQuery: '',
  statusFilter: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectRobot(state, action) {
      state.selectedRobotId = action.payload;
    },
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    setStatusFilter(state, action) {
      state.statusFilter = action.payload;
    }
  }
});

export const { selectRobot, setSearchQuery, setStatusFilter } = uiSlice.actions;
export default uiSlice.reducer;
