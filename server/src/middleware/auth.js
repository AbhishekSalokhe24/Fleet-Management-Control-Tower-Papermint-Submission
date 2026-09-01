const config = require('../config');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const expectedToken = config.get('AUTH_TOKEN', 'fleet-admin-token');

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized. Provide Authorization: Bearer <token>' });
  }

  next();
}

module.exports = authMiddleware;
