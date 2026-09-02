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
    pruneToFleetSize(state, action) {
      const fleetSize = action.payload;
      if (!fleetSize || typeof fleetSize !== 'number') return;
      const filtered = {};
      for (const [id, robot] of Object.entries(state.robots)) {
        const num = parseInt(id.replace('r', ''), 10);
        if (num <= fleetSize) {
          filtered[id] = robot;
        }
      }
      state.robots = filtered;
    },
    setConnected(state, action) {
      state.connected = action.payload;
    }
  }
});

export const { setFleet, updateRobots, pruneToFleetSize, setConnected } = fleetSlice.actions;
export default fleetSlice.reducer;
