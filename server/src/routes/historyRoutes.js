const express = require('express');

function createHistoryRoutes(historyService, fleetState) {
  const router = express.Router();

  router.get('/:id', async (req, res) => {
    const robotId = req.params.id;
    const from = parseInt(req.query.from) || 0;
    const to = parseInt(req.query.to) || Date.now();

    const history = await historyService.getHistory(robotId, from, to);

    if (history.length === 0) {
      const exists = fleetState.current.has(robotId);
      if (!exists) {
        return res.status(404).json({ error: 'Robot not found' });
      }
    }

    res.json({
      robot_id: robotId,
      from,
      to,
      count: history.length,
      events: history,
    });
  });

  return router;
}

module.exports = { createHistoryRoutes };
