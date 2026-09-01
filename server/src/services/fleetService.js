const { getPrismaClient } = require('../prisma');

class FleetService {
  constructor(fleetState) {
    this.fleetState = fleetState;
  }

  upsertRobotState(event) {
    const updated = this.fleetState.upsert(event);
    if (!updated) return false;

    // Async write to Prisma — chain event insert AFTER robot upsert to satisfy FK
    const prisma = getPrismaClient();
    
    prisma.robot.upsert({
      where: { id: event.robot_id },
      update: {
        x: event.x,
        y: event.y,
        status: event.status,
        battery: event.battery,
        lastSeen: new Date(event.timestamp),
      },
      create: {
        id: event.robot_id,
        type: event.robot_type || 'unknown',
        x: event.x,
        y: event.y,
        status: event.status,
        battery: event.battery,
        lastSeen: new Date(event.timestamp),
      }
    }).then(() => {
      // Only insert event AFTER robot row exists
      return prisma.robotEvent.create({
        data: {
          robotId: event.robot_id,
          t: event.t,
          x: event.x,
          y: event.y,
          status: event.status,
          battery: event.battery,
          taskEvent: event.task_event || null,
          timestamp: new Date(event.timestamp),
        }
      });
    }).catch(err => {
      console.error('[db] Error writing robot data:', err.message);
    });

    return true;
  }

  upsertBatch(events) {
    let updated = 0;
    for (const event of events) {
      if (this.upsertRobotState(event)) {
        updated++;
      }
    }

    // Handle trend snapshot delegation via State's periodic trigger
    const now = Date.now();
    if (now - this.fleetState.lastTrendSnapshot >= 1000) {
      this.fleetState._takeTrendSnapshot(now);
      this.fleetState.lastTrendSnapshot = now;
      
      // We can also trigger TrendService async insert here, but to keep it decoupled,
      // we'll let trendService listen or poll, or we can just call trendService.recordSnapshot.
    }
    return updated;
  }
}

module.exports = { FleetService };
