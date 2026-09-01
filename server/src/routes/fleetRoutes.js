const express = require('express');

function createFleetRoutes(fleetState) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const robots = fleetState.getAll();
    const summary = fleetState.getSummary();
    res.json({ robots, summary, timestamp: Date.now() });
  });

  router.get('/:id', (req, res) => {
    const robot = fleetState.getOne(req.params.id);
    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
    }
    res.json({ robot, timestamp: Date.now() });
  });

  return router;
}

module.exports = { createFleetRoutes };
