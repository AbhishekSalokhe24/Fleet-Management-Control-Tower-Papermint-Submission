import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  fleetSize: 8,
  updateIntervalMs: 5000,
  loading: false,
  error: null,
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setConfig(state, action) {
      state.fleetSize = action.payload.FLEET_SIZE;
      state.updateIntervalMs = action.payload.UPDATE_INTERVAL_MS;
      state.loading = false;
      state.error = null;
    },
    updateConfig(state) {
      // Picked up by saga
      state.loading = true;
    },
    updateConfigSuccess(state) {
      state.loading = false;
      state.error = null;
    },
    updateConfigFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    fetchConfig() {
      // Picked up by saga
    }
  }
});

export const { setConfig, updateConfig, updateConfigSuccess, updateConfigFailure, fetchConfig } = configSlice.actions;
export default configSlice.reducer;
