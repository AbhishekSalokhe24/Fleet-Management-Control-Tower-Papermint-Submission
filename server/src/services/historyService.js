const { getPrismaClient } = require('../prisma');

class HistoryService {
  async getHistory(robotId, fromMs = 0, toMs = Date.now()) {
    const prisma = getPrismaClient();
    try {
      return await prisma.robotEvent.findMany({
        where: {
          robotId: robotId,
          timestamp: {
            gte: new Date(fromMs),
            lte: new Date(toMs)
          }
        },
        orderBy: { timestamp: 'asc' }
      });
    } catch (err) {
      console.error('[db] Error fetching history:', err.message);
      return [];
    }
  }
}

module.exports = { HistoryService };
