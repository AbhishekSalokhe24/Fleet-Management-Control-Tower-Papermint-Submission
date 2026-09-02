const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { FleetManager } = require('./simulator/fleet');
const { FleetState } = require('./state');
const { WebSocketBroadcaster } = require('./websocket');
const { FleetService } = require('./services/fleetService');
const { TrendService } = require('./services/trendService');
const { HistoryService } = require('./services/historyService');
const { createFleetRoutes } = require('./routes/fleetRoutes');
const { createTrendRoutes } = require('./routes/trendRoutes');
const { createConfigRoutes } = require('./routes/configRoutes');
const { createHistoryRoutes } = require('./routes/historyRoutes');
const { getPrismaClient, disconnectPrisma } = require('./prisma');

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);

  const fleetState = new FleetState();
  const fleetManager = new FleetManager();
  const wsBroadcaster = new WebSocketBroadcaster(server, fleetState);
  
  const fleetService = new FleetService(fleetState);
  const trendService = new TrendService(fleetState);
  const historyService = new HistoryService();

  // Test DB connection
  try {
    const prisma = getPrismaClient();
    await prisma.$connect();
    console.log('[db] Prisma connected');
  } catch (err) {
    console.error('[db] Prisma failed to connect:', err.message);
  }

  // Wire simulator events
  fleetManager.on('events', (events) => {
    fleetService.upsertBatch(events);
    wsBroadcaster.broadcast(events);
  });

  // Wire trend snapshots
  // The state store holds the latest snapshot time and calculates it.
  // We can poll or listen to events, but since the FleetService triggers it, 
  // we could just fetch the latest from FleetState every second.
  setInterval(() => {
    const trends = fleetState.trends;
    if (trends.length > 0) {
      const latest = trends[trends.length - 1];
      // Only insert if it hasn't been inserted yet (tracked via timestamp in memory if needed)
      // For simplicity, we just save every minute's snapshot to the DB instead of every second
      // to reduce DB spam, but let's stick to the plan:
    }
  }, 60000); 

  // Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      robots: fleetState.current.size,
      dashboards: wsBroadcaster.getClientCount(),
      timestamp: Date.now(),
    });
  });

  app.use('/api/fleet', createFleetRoutes(fleetState));
  app.use('/api/trends', createTrendRoutes(fleetState, trendService));
  app.use('/api/config', createConfigRoutes(fleetManager, wsBroadcaster, fleetState));
  app.use('/api/history', createHistoryRoutes(historyService, fleetState));

  // Serve Dashboard (optional, if we put static files in dashboard/dist)
  const dashboardPath = path.resolve(__dirname, '../../dashboard/dist');
  app.use(express.static(dashboardPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/robots')) {
      return next();
    }
    res.sendFile(path.join(dashboardPath, 'index.html'));
  });

  const PORT = config.getInt('PORT', 3001);
  server.listen(PORT, () => {
    console.log(`\n🤖 Fleet Server running on port ${PORT}`);
    fleetManager.start();
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[server] Shutting down...');
    fleetManager.stop();
    server.close();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
