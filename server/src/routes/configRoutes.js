const express = require('express');
const config = require('../config');
const authMiddleware = require('../middleware/auth');

function createConfigRoutes(fleetManager, wsBroadcaster, fleetState) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const cfg = config.getAllConfig();
    const { AUTH_TOKEN, ...safeConfig } = cfg;
    res.json({ config: safeConfig, timestamp: Date.now() });
  });

  router.post('/', authMiddleware, (req, res) => {
    const { FLEET_SIZE, UPDATE_INTERVAL_MS } = req.body;
    const changes = {};

    if (FLEET_SIZE !== undefined) {
      const size = parseInt(FLEET_SIZE, 10);
      if (isNaN(size) || size < 1 || size > 10000) {
        return res.status(400).json({ error: 'FLEET_SIZE must be 1-10000' });
      }
      config.setRuntime('FLEET_SIZE', size);
      changes.FLEET_SIZE = size;
    }

    if (UPDATE_INTERVAL_MS !== undefined) {
      const interval = parseInt(UPDATE_INTERVAL_MS, 10);
      if (isNaN(interval) || interval < 100 || interval > 60000) {
        return res.status(400).json({ error: 'UPDATE_INTERVAL_MS must be 100-60000' });
      }
      config.setRuntime('UPDATE_INTERVAL_MS', interval);
      changes.UPDATE_INTERVAL_MS = interval;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No valid config changes provided' });
    }

    if ((changes.FLEET_SIZE !== undefined || changes.UPDATE_INTERVAL_MS !== undefined) && fleetManager) {
      if (changes.FLEET_SIZE !== undefined && fleetState) {
        fleetState.pruneRobots(changes.FLEET_SIZE);
      }
      fleetManager.reconfigure();
    }

    if (wsBroadcaster) {
      const cfg = config.getAllConfig();
      const { AUTH_TOKEN, ...safeConfig } = cfg;
      wsBroadcaster.broadcastConfigChange(safeConfig);
      wsBroadcaster.broadcastSnapshot();
    }

    const cfg = config.getAllConfig();
    const { AUTH_TOKEN, ...safeConfig } = cfg;
    res.json({ message: 'Config updated', changes, config: safeConfig });
  });

  return router;
}

module.exports = { createConfigRoutes };
