import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  robots: {}, // { id: robotData }
  summary: {
    total: 0, working: 0, attention: 0, critical: 0, idle: 0, avgBattery: 0, lowBattery: 0
  },
  connected: false,
  lastUpdate: null,
};

const fleetSlice = createSlice({
  name: 'fleet',
  initialState,
  reducers: {
    setFleet(state, action) {
      const { robots, summary, timestamp } = action.payload;
      const robotMap = {};
      robots.forEach(r => { robotMap[r.robot_id] = r; });
      state.robots = robotMap;
      state.summary = summary;
      state.lastUpdate = timestamp;
    },
    updateRobots(state, action) {
      const { events, summary, timestamp } = action.payload;
      events.forEach(e => {
        if (state.robots[e.robot_id]) {
          state.robots[e.robot_id] = { ...state.robots[e.robot_id], ...e };
        } else {
          state.robots[e.robot_id] = e;
        }
      });
      if (summary) state.summary = summary;
      state.lastUpdate = timestamp;
    },
    setConnected(state, action) {
      state.connected = action.payload;
    }
  }
});

export const { setFleet, updateRobots, setConnected } = fleetSlice.actions;
export default fleetSlice.reducer;
