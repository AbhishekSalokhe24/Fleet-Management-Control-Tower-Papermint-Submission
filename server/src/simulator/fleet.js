const { Robot, isInsideObstacle } = require('./robot');
const config = require('../config');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const ROBOT_TYPES = ['picker', 'hauler'];

// ─── Load robots.json for the first 8 canonical positions/types ──
let CANONICAL_ROBOTS = [];
try {
  const robotsPath = path.resolve(__dirname, '../../../robots.json');
  CANONICAL_ROBOTS = JSON.parse(fs.readFileSync(robotsPath, 'utf-8'));
  console.log(`[fleet] Loaded ${CANONICAL_ROBOTS.length} canonical robots from robots.json`);
} catch (e) {
  console.warn('[fleet] Could not load robots.json, will use random positions:', e.message);
}

class FleetManager extends EventEmitter {
  constructor() {
    super();
    this.robots = new Map();
    this.intervalHandle = null;
    this.startTime = Date.now();
    this.running = false;
  }

  initialize() {
    const cfg = config.getAllConfig();
    const fleetSize = cfg.FLEET_SIZE;
    const siteW = cfg.SITE_WIDTH;
    const siteH = cfg.SITE_HEIGHT;

    console.log(`[fleet] Initializing fleet with ${fleetSize} robots`);

    // Remove robots beyond the new fleet size
    const existingIds = [...this.robots.keys()];
    for (const id of existingIds) {
      const num = parseInt(id.replace('r', ''), 10);
      if (num > fleetSize) {
        this.robots.delete(id);
      }
    }

    for (let i = 1; i <= fleetSize; i++) {
      const id = `r${i}`;
      if (!this.robots.has(id)) {
        let type, x, y;

        // Use canonical data from robots.json for the first 8
        const canonical = CANONICAL_ROBOTS.find(r => r.robot_id === id);
        if (canonical) {
          type = canonical.robot_type;
          x = canonical.start.x;
          y = canonical.start.y;
        } else {
          // For robots beyond 8, generate obstacle-free random positions
          type = ROBOT_TYPES[i % ROBOT_TYPES.length];
          const margin = 30;
          let attempts = 0;
          do {
            x = margin + Math.random() * (siteW - 2 * margin);
            y = margin + Math.random() * (siteH - 2 * margin);
            attempts++;
          } while (isInsideObstacle(x, y) && attempts < 100);
        }

        const robot = new Robot(id, type, x, y);
        this.robots.set(id, robot);
      }
    }
  }

  start() {
    if (this.running) this.stop();
    this.initialize();
    this.running = true;
    this.startTime = Date.now();

    const tick = () => {
      if (!this.running) return;

      const intervalMs = config.getInt('UPDATE_INTERVAL_MS', 5000);
      const events = [];
      for (const robot of this.robots.values()) {
        const event = robot.tick(intervalMs);
        event.timestamp = Date.now();
        events.push(event);
      }

      this.emit('events', events);

      if (this.running) {
        this.intervalHandle = setTimeout(tick, intervalMs);
      }
    };

    tick();
    console.log(`[fleet] Simulation started`);
  }

  stop() {
    this.running = false;
    if (this.intervalHandle) {
      clearTimeout(this.intervalHandle);
      this.intervalHandle = null;
    }
    console.log('[fleet] Simulation stopped');
  }

  reconfigure() {
    console.log('[fleet] Reconfiguring...');
    if (this.running) {
      this.start();
    } else {
      this.initialize();
    }
  }
}

module.exports = { FleetManager };
