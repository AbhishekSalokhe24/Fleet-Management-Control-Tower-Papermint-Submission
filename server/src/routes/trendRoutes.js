const express = require('express');

function createTrendRoutes(fleetState, trendService) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const windowSeconds = parseInt(req.query.window) || 300;
    
    // For small windows, in-memory is enough and faster.
    // For larger ones (or if server restarted), we could fallback to trendService DB query.
    // To keep it simple, we use in-memory which holds up to 1 hour (3600 items).
    let trends = fleetState.getTrends(windowSeconds);
    
    res.json({ trends, window: windowSeconds, timestamp: Date.now() });
  });

  return router;
}

module.exports = { createTrendRoutes };
