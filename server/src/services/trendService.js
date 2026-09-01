const { getPrismaClient } = require('../prisma');

class TrendService {
  constructor(fleetState) {
    this.fleetState = fleetState;
  }

  async recordSnapshot(snapshot) {
    const prisma = getPrismaClient();
    try {
      await prisma.trendSnapshot.create({
        data: {
          timestamp: new Date(snapshot.timestamp),
          total: snapshot.total,
          idle: snapshot.idle,
          active: snapshot.active,
          onMission: snapshot.on_mission,
          charging: snapshot.charging,
          blocked: snapshot.blocked,
          error: snapshot.error,
          maintenance: snapshot.maintenance,
          offline: snapshot.offline,
          avgBattery: snapshot.avgBattery,
        }
      });
    } catch (err) {
      console.error('[db] Error inserting trend snapshot:', err.message);
    }
  }

  async getTrendsFromDb(windowSeconds) {
    const prisma = getPrismaClient();
    const cutoff = new Date(Date.now() - windowSeconds * 1000);
    return prisma.trendSnapshot.findMany({
      where: {
        timestamp: { gte: cutoff }
      },
      orderBy: { timestamp: 'asc' }
    });
  }
}

module.exports = { TrendService };
