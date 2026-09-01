import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  data: [],
  window: 300,
  loading: false,
};

const trendsSlice = createSlice({
  name: 'trends',
  initialState,
  reducers: {
    setTrends(state, action) {
      state.data = action.payload;
      state.loading = false;
    },
    setWindow(state, action) {
      state.window = action.payload;
      state.loading = true;
    },
    fetchTrends(state, action) {
      // Picked up by saga
      state.window = action.payload;
      state.loading = true;
    }
  }
});

export const { setTrends, setWindow, fetchTrends } = trendsSlice.actions;
export default trendsSlice.reducer;
