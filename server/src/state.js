// ─── In-Memory State Store ────────────────────────────────────
// Maintains current fleet state (Map) and history (Ring Buffer).
// Thread-safe by nature in single-threaded Node.js.
// Dual-write architecture: this is the synchronous fast-path.

const config = require('./config');

class FleetState {
  constructor() {
    // Current state: robot_id → latest event data
    this.current = new Map();

    // History ring buffer: fixed-size array of events (for fast memory reads if needed)
    this.historyMaxSize = 100000;
    this.history = [];

    // Trend snapshots
    this.trendMaxSize = 3600;
    this.trends = [];
    this.lastTrendSnapshot = 0;

    this.staleRobots = new Set();
  }

  /**
   * Upsert a robot's state. O(1) operation.
   */
  upsert(event) {
    const existing = this.current.get(event.robot_id);

    // Only update if this event is newer
    if (existing && existing.timestamp && event.timestamp && event.timestamp < existing.timestamp) {
      return false; 
    }

    this.current.set(event.robot_id, {
      ...event,
      last_seen: Date.now(),
    });

    this.staleRobots.delete(event.robot_id);
    
    // Add to in-memory history
    this.history.push({ ...event, received_at: Date.now() });
    if (this.history.length > this.historyMaxSize) {
      this.history = this.history.slice(this.history.length - this.historyMaxSize);
    }
    
    return true;
  }

  /**
   * Process a batch of events
   */
  upsertBatch(events) {
    let updated = 0;
    for (const event of events) {
      if (this.upsert(event)) updated++;
    }

    const now = Date.now();
    if (now - this.lastTrendSnapshot >= 1000) {
      this._takeTrendSnapshot(now);
      this.lastTrendSnapshot = now;
    }
    return updated;
  }

  getAll() {
    const result = [];
    const staleThreshold = config.getInt('STALE_TIMEOUT_MS', 15000);
    const now = Date.now();

    for (const [id, state] of this.current) {
      const stale = (now - state.last_seen) > staleThreshold;
      if (stale) this.staleRobots.add(id);

      result.push({
        ...state,
        stale,
      });
    }
    return result;
  }

  getOne(robotId) {
    const state = this.current.get(robotId);
    if (!state) return null;
    const staleThreshold = config.getInt('STALE_TIMEOUT_MS', 15000);
    const stale = (Date.now() - state.last_seen) > staleThreshold;
    return { ...state, stale };
  }

  getTrends(windowSeconds = 300) {
    const cutoff = Date.now() - windowSeconds * 1000;
    return this.trends.filter((t) => t.timestamp >= cutoff);
  }

  _takeTrendSnapshot(now) {
    const counts = { idle: 0, active: 0, on_mission: 0, charging: 0, blocked: 0, error: 0, maintenance: 0, offline: 0 };
    let totalBattery = 0, total = 0;

    for (const state of this.current.values()) {
      if (counts[state.status] !== undefined) counts[state.status]++;
      totalBattery += state.battery || 0;
      total++;
    }

    this.trends.push({
      timestamp: now,
      total,
      avgBattery: total > 0 ? Math.round((totalBattery / total) * 10) / 10 : 0,
      ...counts,
    });

    if (this.trends.length > this.trendMaxSize) {
      this.trends = this.trends.slice(this.trends.length - this.trendMaxSize);
    }
  }

  getSummary() {
    let total = 0, working = 0, attention = 0, critical = 0;
    let totalBattery = 0, lowBatteryCount = 0;

    for (const state of this.current.values()) {
      total++;
      totalBattery += state.battery || 0;
      if (state.battery < 20) lowBatteryCount++;

      switch (state.status) {
        case 'active':
        case 'on_mission':
          working++; break;
        case 'blocked':
        case 'maintenance':
          attention++; break;
        case 'error':
        case 'offline':
          critical++; break;
      }
    }

    return {
      total, working, attention, critical,
      idle: total - working - attention - critical,
      avgBattery: total > 0 ? Math.round((totalBattery / total) * 10) / 10 : 0,
      lowBattery: lowBatteryCount,
    };
  }
}

module.exports = { FleetState };
