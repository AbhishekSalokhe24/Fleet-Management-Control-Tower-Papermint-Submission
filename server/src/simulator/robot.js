const config = require('../config');

const STATUSES = ['idle', 'active', 'on_mission', 'charging', 'blocked', 'error', 'maintenance', 'offline'];
const MOVING_STATUSES = new Set(['active', 'on_mission']);

// ─── Obstacle Zones ──────────────────────────────────────────
// Rectangles extracted from layout.png (900×560).
// Each is { x1, y1, x2, y2 } with a padding margin around the visual shape.
const OBSTACLES = [
  { x1: 115, y1:  65, x2: 385, y2: 145 },   // top-left shelf
  { x1: 110, y1: 185, x2: 365, y2: 265 },   // mid-left shelf
  { x1: 110, y1: 315, x2: 375, y2: 400 },   // bottom-left shelf
  { x1: 465, y1:  40, x2: 555, y2: 450 },   // center vertical pillar
  { x1: 630, y1: 105, x2: 870, y2: 190 },   // top-right shelf
  { x1: 635, y1: 285, x2: 865, y2: 375 },   // bottom-right shelf
];

const PADDING = 8; // extra clearance around obstacles

function isInsideObstacle(x, y) {
  for (const obs of OBSTACLES) {
    if (x >= obs.x1 - PADDING && x <= obs.x2 + PADDING &&
        y >= obs.y1 - PADDING && y <= obs.y2 + PADDING) {
      return true;
    }
  }
  return false;
}

// Push a point outside the nearest obstacle if it's inside one
function pushOutOfObstacle(x, y) {
  for (const obs of OBSTACLES) {
    if (x >= obs.x1 - PADDING && x <= obs.x2 + PADDING &&
        y >= obs.y1 - PADDING && y <= obs.y2 + PADDING) {
      // Find the nearest edge and push out
      const dLeft = x - (obs.x1 - PADDING);
      const dRight = (obs.x2 + PADDING) - x;
      const dTop = y - (obs.y1 - PADDING);
      const dBottom = (obs.y2 + PADDING) - y;
      const minDist = Math.min(dLeft, dRight, dTop, dBottom);

      if (minDist === dLeft) return { x: obs.x1 - PADDING - 1, y };
      if (minDist === dRight) return { x: obs.x2 + PADDING + 1, y };
      if (minDist === dTop) return { x, y: obs.y1 - PADDING - 1 };
      return { x, y: obs.y2 + PADDING + 1 };
    }
  }
  return { x, y };
}

// Check if the line segment from (x1,y1) to (x2,y2) crosses an obstacle
function pathCrossesObstacle(x1, y1, x2, y2) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 5;
  for (let i = 0; i <= steps; i++) {
    const t = steps > 0 ? i / steps : 0;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (isInsideObstacle(px, py)) return true;
  }
  return false;
}

const TRANSITION_MAP = {
  idle:        { active: 40, on_mission: 10, charging: 5, maintenance: 5, offline: 2, idle: 38 },
  active:      { on_mission: 30, idle: 15, blocked: 10, maintenance: 5, error: 3, active: 37 },
  on_mission:  { idle: 15, active: 10, blocked: 12, on_mission: 58, error: 3, maintenance: 2 },
  charging:    { idle: 10, charging: 90 },
  blocked:     { active: 20, idle: 25, blocked: 45, error: 5, on_mission: 5 },
  error:       { idle: 25, error: 60, maintenance: 10, offline: 5 },
  maintenance: { idle: 30, maintenance: 60, error: 5, active: 5 },
  offline:     { idle: 30, offline: 60, error: 10 },
};

const MIN_TICKS_IN_STATUS = {
  idle: 2, active: 3, on_mission: 4, charging: 3, blocked: 2, error: 3, maintenance: 3, offline: 3,
};

class Robot {
  constructor(id, type, startX, startY, startBattery = null) {
    this.id = id;
    this.type = type;
    this.x = startX;
    this.y = startY;
    this.status = 'idle';
    this.battery = startBattery !== null ? startBattery : 20 + Math.random() * 80;
    this.targetX = startX;
    this.targetY = startY;
    this.ticksInStatus = 0;
    this.tickCount = 0;
    
    const cfg = config.getAllConfig();
    this.siteWidth = cfg.SITE_WIDTH;
    this.siteHeight = cfg.SITE_HEIGHT;
    this.speed = cfg.ROBOT_SPEED + (Math.random() - 0.5) * 1.0;
  }

  tick(intervalMs) {
    const dt = intervalMs / 1000;
    this.tickCount++;
    this.ticksInStatus++;

    this._updateBattery(dt);
    this._maybeTransitionStatus();

    if (MOVING_STATUSES.has(this.status)) {
      this._move(dt);
    }

    return {
      t: this.tickCount * (intervalMs / 1000),
      robot_id: this.id,
      robot_type: this.type,
      x: Math.round(this.x * 10) / 10,
      y: Math.round(this.y * 10) / 10,
      status: this.status,
      battery: Math.round(this.battery * 10) / 10,
    };
  }

  _updateBattery(dt) {
    const cfg = config.getAllConfig();
    switch (this.status) {
      case 'active':
      case 'on_mission':
        this.battery -= cfg.BATTERY_DRAIN_ACTIVE * dt; break;
      case 'charging':
        this.battery += cfg.BATTERY_CHARGE_RATE * dt; break;
      case 'idle':
      case 'blocked':
      case 'maintenance':
      case 'error':
        this.battery -= cfg.BATTERY_DRAIN_IDLE * dt; break;
      case 'offline':
        this.battery -= cfg.BATTERY_DRAIN_IDLE * 0.5 * dt; break;
    }
    this.battery = Math.max(0, Math.min(100, this.battery));
  }

  _maybeTransitionStatus() {
    const cfg = config.getAllConfig();
    const minTicks = MIN_TICKS_IN_STATUS[this.status] || 2;
    if (this.ticksInStatus < minTicks) return;

    if (this.battery < cfg.LOW_BATTERY_THRESHOLD && this.status !== 'charging' && this.status !== 'offline') {
      this._setStatus('charging'); return;
    }
    if (this.status === 'charging' && this.battery >= cfg.CHARGE_TARGET) {
      this._setStatus('idle'); return;
    }

    const transitions = TRANSITION_MAP[this.status];
    if (!transitions) return;
    const entries = Object.entries(transitions);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;

    for (const [nextStatus, weight] of entries) {
      roll -= weight;
      if (roll <= 0) {
        if (nextStatus !== this.status) this._setStatus(nextStatus);
        return;
      }
    }
  }

  _setStatus(newStatus) {
    this.status = newStatus;
    this.ticksInStatus = 0;
    if (MOVING_STATUSES.has(newStatus)) this._pickNewTarget();
  }

  _pickNewTarget() {
    const margin = 15;
    // Try up to 20 times to find a clear target position
    for (let attempt = 0; attempt < 20; attempt++) {
      const spread = 80 + Math.random() * 150;
      const angle = Math.random() * Math.PI * 2;
      let tx = this.x + Math.cos(angle) * spread;
      let ty = this.y + Math.sin(angle) * spread;
      tx = Math.max(margin, Math.min(this.siteWidth - margin, tx));
      ty = Math.max(margin, Math.min(this.siteHeight - margin, ty));

      if (!isInsideObstacle(tx, ty) && !pathCrossesObstacle(this.x, this.y, tx, ty)) {
        this.targetX = tx;
        this.targetY = ty;
        return;
      }
    }
    // Fallback: pick any clear spot
    for (let attempt = 0; attempt < 50; attempt++) {
      const tx = margin + Math.random() * (this.siteWidth - 2 * margin);
      const ty = margin + Math.random() * (this.siteHeight - 2 * margin);
      if (!isInsideObstacle(tx, ty)) {
        this.targetX = tx;
        this.targetY = ty;
        return;
      }
    }
  }

  _move(dt) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) { this._pickNewTarget(); return; }

    const step = this.speed * dt;
    const ratio = Math.min(step / dist, 1);
    let newX = this.x + dx * ratio;
    let newY = this.y + dy * ratio;
    newX = Math.max(0, Math.min(this.siteWidth, newX));
    newY = Math.max(0, Math.min(this.siteHeight, newY));

    // If the new position is inside an obstacle, don't move — pick a new target instead
    if (isInsideObstacle(newX, newY)) {
      const pushed = pushOutOfObstacle(newX, newY);
      this.x = pushed.x;
      this.y = pushed.y;
      this._pickNewTarget();
      return;
    }

    this.x = newX;
    this.y = newY;
  }

  reset(startX, startY) {
    this.x = startX; this.y = startY;
    this.targetX = startX; this.targetY = startY;
    this.status = 'idle'; this.battery = 20 + Math.random() * 80;
    this.ticksInStatus = 0; this.tickCount = 0;
  }
}

module.exports = { Robot, STATUSES, MOVING_STATUSES, OBSTACLES, isInsideObstacle };
