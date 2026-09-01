const WebSocket = require('ws');

class WebSocketBroadcaster {
  constructor(server, fleetState) {
    this.fleetState = fleetState;
    this.clients = new Set();

    this.wss = new WebSocket.Server({
      server,
      path: '/ws/fleet',
    });

    this.wss.on('connection', (ws, req) => {
      console.log(`[ws] Dashboard connected (total: ${this.clients.size + 1})`);
      this.clients.add(ws);
      this._sendSnapshot(ws);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch (e) {
          // Ignore
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[ws] Dashboard disconnected (total: ${this.clients.size})`);
      });

      ws.on('error', (err) => {
        console.error('[ws] Client error:', err.message);
        this.clients.delete(ws);
      });
    });

    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.clients.delete(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(this.heartbeatInterval);
    });

    this.wss.on('connection', (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });
  }

  _sendSnapshot(ws) {
    if (ws.readyState !== WebSocket.OPEN) return;
    const snapshot = {
      type: 'snapshot',
      timestamp: Date.now(),
      robots: this.fleetState.getAll(),
      summary: this.fleetState.getSummary(),
    };
    try {
      ws.send(JSON.stringify(snapshot));
    } catch (e) {}
  }

  broadcast(events) {
    if (this.clients.size === 0) return;
    const message = JSON.stringify({
      type: 'update',
      timestamp: Date.now(),
      events,
      summary: this.fleetState.getSummary(),
    });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (e) {
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    }
  }

  broadcastConfigChange(newConfig) {
    const message = JSON.stringify({
      type: 'config_changed',
      timestamp: Date.now(),
      config: newConfig,
    });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (e) {
          this.clients.delete(client);
        }
      }
    }
  }

  getClientCount() {
    return this.clients.size;
  }
}

module.exports = { WebSocketBroadcaster };
