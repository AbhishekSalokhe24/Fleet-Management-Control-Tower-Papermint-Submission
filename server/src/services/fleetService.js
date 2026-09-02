const { getPrismaClient } = require('../prisma');

// ─── Write Queue ──────────────────────────────────────────────
// Instead of firing individual DB queries per robot per tick,
// we buffer events and flush them in a single batched transaction.
// This keeps the connection pool usage bounded regardless of fleet size.

const FLUSH_INTERVAL_MS = 500;   // Flush at most every 500ms
const MAX_BUFFER_SIZE = 200;     // Force flush if buffer grows too large

let writeBuffer = [];
let flushTimer = null;
let flushing = false;

async function flushWriteBuffer() {
  if (flushing || writeBuffer.length === 0) return;
  flushing = true;

  // Grab the current buffer and reset it so new events don't block
  const batch = writeBuffer;
  writeBuffer = [];

  const prisma = getPrismaClient();

  try {
    // De-duplicate: keep only the latest event per robot_id in this batch
    const latestByRobot = new Map();
    const allEvents = [];

    for (const event of batch) {
      latestByRobot.set(event.robot_id, event);
      allEvents.push(event);
    }

    // Build transaction operations
    const ops = [];

    // 1. Upsert each unique robot (de-duplicated — at most N robots)
    for (const event of latestByRobot.values()) {
      ops.push(
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
        })
      );
    }

    // 2. Insert all events (append-only log — keep every data point)
    for (const event of allEvents) {
      ops.push(
        prisma.robotEvent.create({
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
        })
      );
    }

    // Execute everything in a single transaction
    // This uses only 1 connection from the pool for the entire batch
    await prisma.$transaction(ops, {
      timeout: 30000, // 30s timeout for large batches
    });

  } catch (err) {
    console.error(`[db] Batch write error (${batch.length} events):`, err.message);
  } finally {
    flushing = false;
  }
}

function scheduleFlush() {
  if (flushTimer) return; // Already scheduled
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushWriteBuffer();
  }, FLUSH_INTERVAL_MS);
}

function enqueueForWrite(event) {
  writeBuffer.push(event);

  // Force immediate flush if buffer is getting too large
  if (writeBuffer.length >= MAX_BUFFER_SIZE) {
    flushWriteBuffer();
  } else {
    scheduleFlush();
  }
}


class FleetService {
  constructor(fleetState) {
    this.fleetState = fleetState;
  }

  upsertRobotState(event) {
    const updated = this.fleetState.upsert(event);
    if (!updated) return false;

    // Queue the event for batched DB write instead of firing immediately
    enqueueForWrite(event);

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
