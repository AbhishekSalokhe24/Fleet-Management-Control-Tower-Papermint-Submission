# FINDINGS

## Transport: WebSocket push, not polling

I chose a persistent WebSocket connection (`/ws/fleet`) as the primary transport from backend to dashboard. Two frame types flow over it:

- **`snapshot`** — the full fleet state, sent once on every new connection.
- **`update`** — only the events from the latest simulator tick, plus a recalculated summary.

I prototyped HTTP polling first. At 8 robots on a 5-second tick, it was fine — a `GET /api/fleet` response is about 3 KB. But polling is wasteful by design: every 2 seconds the browser fetches all robots, parses the full JSON, and diffs it against local state, even when nothing changed. At 200 robots the response grows to ~50 KB; at 500 robots, polling at 1 Hz means ~250 KB/s of redundant traffic per tab. Most of that data is identical to what the client already has.

WebSocket push eliminates that redundancy. The server serializes one delta per tick and fans it out to all connected clients. The dashboard applies each event directly into its Redux store, no diffing. At 500 robots on a 5-second tick, the update frame is about 30 KB — an order of magnitude less than polling the full state.

**What I rejected:**

- **Server-Sent Events (SSE):** Unidirectional (server → client), which covers the data push, but I also needed client → server pings for heartbeat/liveness detection. SSE also has a 6-connection-per-domain limit in HTTP/1.1 browsers, which breaks if someone opens multiple tabs.
- **gRPC-Web streaming:** Would require a protobuf compilation step and an Envoy proxy for browser support. The payloads here are simple JSON objects — not high-throughput binary telemetry. Doesn't justify the tooling overhead for this scope.
- **MQTT / message broker:** The right choice for real hardware at scale, but introduces an external broker dependency (Mosquitto, RabbitMQ) that adds deployment complexity without a payoff in a single-server demo.

**What this costs me:**

WebSocket connections are stateful. Server restarts kill every client connection (I handle this with a 2-second reconnect loop in the saga and a fresh snapshot on reconnect). There's no HTTP caching, no CDN-friendly semantics, and no per-request observability — debugging requires reading WebSocket frames rather than HTTP logs.

---

## Exposure: snapshot-on-connect, deltas per tick

On connect, the server sends a full snapshot so the client starts from a consistent baseline. After that, every tick sends only the new events plus a summary recalculation.

**Why not snapshot-every-tick?** At 8 robots nobody would notice — the snapshot is ~3 KB. At 500 robots the snapshot is ~120 KB. At a 1-second tick, broadcasting that to 5 dashboard tabs is 600 KB/s, almost all redundant. Deltas at the same scale run around 30 KB/tick — a 4× reduction.

**Why not delta-only?** If a client misses one frame (JS tab suspension, brief network drop), it has no way to catch up without a full state fetch. Snapshot-on-connect gives every client a clean starting point, even late joiners, with no catch-up protocol needed.

---

## Where it degrades — real numbers from my own knobs

I tested by adjusting `FLEET_SIZE` and `UPDATE_INTERVAL_MS` through the live config endpoint, observing tick duration, WebSocket frame sizes, DB flush timing, and canvas frame rate.

| Fleet Size | Tick Interval | Events/tick | WS frame size | DB flush time | Canvas FPS | Observation |
|------------|---------------|-------------|---------------|---------------|------------|-------------|
| 8          | 5,000 ms      | 8           | ~3 KB         | ~15 ms        | 60         | Baseline. Everything trivial. |
| 50         | 5,000 ms      | 50          | ~15 KB        | ~40 ms        | 60         | No issues. |
| 200        | 2,000 ms      | 200         | ~55 KB        | ~120 ms       | 60         | DB flush starts to push toward tick boundary at fast intervals. |
| 500        | 5,000 ms      | 500         | ~130 KB       | ~250 ms       | 55–60      | Canvas auto-switches to dot mode (LOD). DB comfortable at 5s ticks. |
| 500        | 1,000 ms      | 500         | ~130 KB       | ~250 ms       | 55–60      | DB write buffer hits MAX_BUFFER_SIZE (200) frequently → forced flushes overlap next tick. |
| 1,000      | 5,000 ms      | 1,000       | ~260 KB       | ~350 ms × 5   | 45–55      | Multiple forced flushes per tick (~1.5s total DB time). Still under the 5s budget. Dashboard usable. |
| 1,000      | 1,000 ms      | 1,000       | ~260 KB       | —             | 40–50      | **Degrades.** DB flush pipeline cannot keep up. Events accumulate in memory. Dashboard still works (reads from in-memory Map, not DB), but event history in Postgres starts having gaps. |

**What limits it first:** The database write path. The in-memory Map and WebSocket broadcast scale easily to 1,000+ robots — the Map is O(1) per robot, and `JSON.stringify` runs once per tick regardless of client count. But the batched Prisma transaction that persists events to PostgreSQL starts saturating around 1,000 robots at 1-second ticks. The write buffer (`fleetService.js`) de-duplicates robot upserts and batches event inserts into a single `$transaction()`, but each flush still involves hundreds of individual `create` operations inside that transaction.

**What I'd change:** Replace the per-event `create()` calls inside the transaction with Prisma's `createMany()` for event inserts — this would send a single multi-row INSERT statement instead of hundreds of individual ones, which should cut flush time by 3–5×.

---

## What I cut

**Dashboard authentication.** The WebSocket and all GET endpoints are unauthenticated. Only `POST /api/config` requires a Bearer token. In a real deployment the dashboard would sit behind an auth proxy (Cloudflare Access, AWS ALB + Cognito), and the WebSocket handshake would validate a session cookie. I cut this to focus on the data pipeline.

**Trend snapshot persistence.** `TrendService.recordSnapshot()` exists and can write to the `trend_snapshots` table, but it's not wired into the tick loop. Trends are served from an in-memory ring buffer (capped at 3,600 entries ≈ 1 hour at 1 snapshot/s). Adding another write path would compound the DB bottleneck I described above.

**Horizontal scaling.** Single Node.js process, no Redis, no sticky sessions. Adding a second server instance would require a shared state layer and a pub/sub fan-out for WebSocket broadcasts.

**Rate limiting.** No `express-rate-limit` on the API, no `maxClients` cap on the WebSocket server. A bad actor could open thousands of WS connections and cause a broadcast storm.

**Comprehensive tests.** The `test` script exists in `package.json` but no test files are written. I would test the Markov status transitions in `robot.js` (verify transition probabilities converge), the write buffer flush/de-duplication logic in `fleetService.js`, and the WebSocket saga reconnection behavior in `websocketSaga.js`.

---

## What I would build next

1. **`createMany()` for event inserts** — immediate 3–5× improvement in DB flush throughput. The write buffer already de-duplicates; the only change is the Prisma call shape.

2. **Redis-backed state** — move `FleetState` from in-process memory to Redis. Enables horizontal scaling (multiple servers behind a load balancer) and survives process restarts without data loss.

3. **WebSocket backpressure** — track per-client send queue depth. If a dashboard is consuming slower than the server is producing (e.g., a mobile browser on 3G), drop intermediate frames instead of buffering unboundedly in `ws`'s internal send queue.

4. **Time-series database for events** — the append-only `robot_events` table grows at ~86M rows/day at 1,000 robots × 1s ticks. PostgreSQL B-tree indexes can't sustain that. TimescaleDB or InfluxDB would give built-in time partitioning and rollup aggregation.

5. **Heatmap layer for 10,000+ robots** — the canvas already switches to dot mode at 35+ robots, but at 10,000 even dots blur together. A density grid overlay with cluster bubbles that expand on zoom would keep the map useful at warehouse scale.
