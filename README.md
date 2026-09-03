# Fleet Management Control Tower

**Live Dashboard:** `https://fleet-management-control-tower.vercel.app/`

**Live Backend:** `https://peppermint-fleet.duckdns.org`

**Health Check:** `https://peppermint-fleet.duckdns.org/api/health`

A real-time fleet management dashboard for warehouse robot operators. A configurable simulator produces live telemetry (position, battery, status) for up to 10,000 robots; a Node.js backend ingests, stores, and broadcasts that state over WebSocket; a React dashboard renders it all — site map, trend charts, robot table, detail drawer — in real time.

## Tech Stack

| Layer     | Choice                                                                 |
| --------- | ---------------------------------------------------------------------- |
| Frontend  | React 19, Vite 8, Ant Design 6, Recharts 3, Redux Toolkit + Redux-Saga |
| Backend   | Node.js, Express 4, `ws` (WebSocket)                                   |
| Database  | PostgreSQL on Neon (serverless), Prisma ORM                            |
| Simulator | In-process event-driven robot simulator (`server/src/simulator/`)      |

---

## Configuration Knobs

Every knob follows a four-level priority chain:

```
Runtime override (POST /api/config) → env var (.env) → config.json → hard-coded default
```

### Server (`server/.env`)

| Variable                | Default | Range        | What it does                                                      |
| ----------------------- | ------- | ------------ | ----------------------------------------------------------------- |
| `FLEET_SIZE`            | `8`     | 1 – 10,000   | Number of simulated robots                                        |
| `UPDATE_INTERVAL_MS`    | `5000`  | 100 – 60,000 | Milliseconds between each simulator tick                          |
| `PORT`                  | `3001`  | any          | HTTP + WebSocket listen port                                      |
| `AUTH_TOKEN`            | _(set)_ | any          | Bearer token required by `POST /api/config`                       |
| `STALE_TIMEOUT_MS`      | `15000` | any          | Ms before a robot with no updates is flagged stale                |
| `SITE_WIDTH`            | `900`   | any          | Warehouse map width (px = distance units, per data contract)      |
| `SITE_HEIGHT`           | `560`   | any          | Warehouse map height                                              |
| `ROBOT_SPEED`           | `3.0`   | any          | Base movement speed (px/s), ±0.5 jitter per robot                 |
| `BATTERY_DRAIN_ACTIVE`  | `0.12`  | any          | Battery %/s drain while `active` or `on_mission`                  |
| `BATTERY_DRAIN_IDLE`    | `0.02`  | any          | Battery %/s drain while `idle`, `blocked`, `maintenance`, `error` |
| `BATTERY_CHARGE_RATE`   | `0.5`   | any          | Battery %/s gain while `charging`                                 |
| `LOW_BATTERY_THRESHOLD` | `20`    | any          | Battery % below which a robot auto-transitions to `charging`      |
| `CHARGE_TARGET`         | `35`    | any          | Battery % at which a charging robot returns to `idle`             |
| `DATABASE_URL`          | _(set)_ | any          | PostgreSQL connection string (used by Prisma)                     |

### Dashboard (`dashboard/.env`)

| Variable       | Default                        | What it does               |
| -------------- | ------------------------------ | -------------------------- |
| `VITE_API_URL` | `http://localhost:3001/api`    | Backend REST API base URL  |
| `VITE_WS_URL`  | `ws://localhost:3001/ws/fleet` | Backend WebSocket endpoint |

---

## Live Controls — Adjusting Fleet Without Redeploying

### Via the Dashboard UI

1. Click the **⚙ Fleet Configuration** button in the header.
2. Adjust **Fleet Size** (1–10,000) and/or **Update Interval** (100–60,000 ms).
3. Enter the **Admin Token** (pre-filled with the deployed token).
4. Click **Apply Changes**.

The server immediately reconfigures the simulator — adds or removes robots, adjusts tick timing — and broadcasts a `config_changed` WebSocket event. Every connected dashboard picks it up within one tick. **Zero downtime, no redeploy.**

### Via curl

```bash
# Read current config
curl https://<YOUR_API>/api/config

# Scale to 200 robots at 2-second ticks
curl -X POST https://<YOUR_API>/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_AUTH_TOKEN>" \
  -d '{"FLEET_SIZE": 200, "UPDATE_INTERVAL_MS": 2000}'
```

The endpoint validates ranges, returns the full updated config, and is protected by a Bearer token. Unauthenticated requests get `401`.

---

## Local Run Steps (Linux)

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **PostgreSQL** database (Neon free tier, local install, Docker — anything)

### 1. Clone

```bash
git clone https://github.com/<your-username>/Fleet-Management-Control-Tower-Papermint-Submission.git
cd Fleet-Management-Control-Tower-Papermint-Submission
```

### 2. Install

```bash
cd server && npm install && cd ..
cd dashboard && npm install && cd ..
```

### 3. Configure

```bash
# Server — set your database URL and a secret token
cat > server/.env << 'EOF'
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
PORT=3001
FLEET_SIZE=8
UPDATE_INTERVAL_MS=5000
AUTH_TOKEN=pick-any-secret-string
EOF

# Dashboard — defaults work for local dev, no edits needed
cp dashboard/.env.example dashboard/.env
```

### 4. Set Up the Database

```bash
cd server
npx prisma generate      # generate Prisma client
npx prisma db push        # apply schema to database
cd ..
```

### 5. Run

**Terminal 1 — Backend (port 3001):**

```bash
cd server && npm run dev   # node --watch, auto-reload on changes
```

**Terminal 2 — Dashboard (port 5173):**

```bash
cd dashboard && npm run dev   # Vite dev server, proxies /api and /ws to :3001
```

Open **http://localhost:5173**.

### 6. Production Build (optional)

```bash
cd dashboard && npm run build   # outputs to dashboard/dist/
cd ../server && npm start       # serves API + static dashboard on port 3001
```

---

## API Reference

| Method | Endpoint               | Auth | Description                                                  |
| ------ | ---------------------- | ---- | ------------------------------------------------------------ |
| GET    | `/api/health`          | No   | Uptime, robot count, connected dashboards                    |
| GET    | `/api/fleet`           | No   | All robots + fleet summary                                   |
| GET    | `/api/fleet/:id`       | No   | Single robot detail                                          |
| GET    | `/api/trends?window=N` | No   | Status-distribution snapshots for last N seconds             |
| GET    | `/api/history/:id`     | No   | Event log for a specific robot (time range via `?from=&to=`) |
| GET    | `/api/config`          | No   | Current config (token redacted)                              |
| POST   | `/api/config`          | Yes  | Update fleet size / tick interval at runtime                 |
| WS     | `/ws/fleet`            | No   | Real-time fleet updates (`snapshot` + `update` frames)       |

### History Endpoint (Optional Stretch Goal)

```
GET /api/history/r3?from=1725300000000&to=1725310000000
```

Persisted in PostgreSQL (`robot_events` table, indexed on `(robot_id, timestamp)`). I chose Postgres because it was already in the stack for robot state, and the append-only event log maps naturally to a relational table with B-tree indexes on the time range.

---

## Status Classification

The challenge spec deliberately leaves status classification up to the builder. Here is my call:

| Category      | Statuses                 | Rationale                                                       |
| ------------- | ------------------------ | --------------------------------------------------------------- |
| **Working**   | `active`, `on_mission`   | Robot is doing productive work or traveling to do work          |
| **Available** | `idle`, `charging`       | Not producing, but not broken — will be available soon          |
| **Attention** | `blocked`, `maintenance` | Needs operator awareness; might need manual intervention        |
| **Critical**  | `error`, `offline`       | Something is wrong; operator action likely required immediately |

---

## AI Delegation Notes

| Area                             | What AI helped with                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Prisma schema**                | Initial model generation (`Robot`, `RobotEvent`, `TrendSnapshot`), including index placement                         |
| **Obstacle collision geometry**  | `OBSTACLES` array coordinates, `isInsideObstacle`, `pushOutOfObstacle`, and `pathCrossesObstacle` in `robot.js`      |
| **Canvas rendering**             | `SiteMap.jsx` — sprite drawing, dot/swarm mode, label pills, hover hit-testing scaffolded by AI, then manually tuned |
| **Redux-Saga WebSocket channel** | `websocketSaga.js` event-channel pattern with auto-reconnect loop generated by AI, then adjusted                     |
| **Batched DB write queue**       | Flush interval, max buffer, de-duplication logic in `fleetService.js` co-authored with AI                            |
| **Boilerplate wiring**           | Express routes, Redux slices, Axios service layer, Vite proxy config scaffolded by AI                                |

All AI-generated code was reviewed, tested, and modified. Architectural decisions, tradeoff analysis, and system design are my own work.
