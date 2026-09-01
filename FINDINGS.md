# Challenge Findings & Data Analysis

## Source Data Analysis
I analyzed the provided `robots.json` and `events.jsonl` files to understand the data contract:
1. **Coordinate System**: The `layout.png` acts as the map. (0,0) is top-left. Standard image coordinates apply.
2. **Status Transitions**: Robots move between `idle`, `active`, `on_mission`, `charging`, `blocked`, `maintenance`, `error`, and `offline`.
3. **Movement**: Robots only change X/Y coordinates when their status is `active` or `on_mission`.
4. **Battery Drain**: Battery drops slowly during `idle` and faster during `active`. It replenishes only when `charging`.

## Implementation Decisions

### Why Canvas over DOM?
For 8 robots, rendering `<div>` tags on the map is fine. However, the challenge mentions scaling to 800+ robots. Rendering 800 moving DOM nodes causes severe layout thrashing and FPS drops. We implemented an HTML5 `<canvas>` rendering loop using `requestAnimationFrame`, which easily handles thousands of dots.

### Why Dual-Write?
Writing every movement of 800 robots every 5 seconds to a remote PostgreSQL database (like Neon or AWS RDS) creates a massive write bottleneck. If the dashboard queried the DB directly for live data, it would experience significant latency.
Instead, the backend stores the *live* state in an in-memory Node.js `Map`. The WebSocket streams this directly to the UI. The database writes happen asynchronously in the background.

### Why Redux Saga?
WebSocket connections are stateful side-effects. Redux Thunks are poor at managing continuous streams of data and reconnect logic. Redux Saga's `eventChannel` is perfectly suited for wrapping the WebSocket API, intercepting messages, and dispatching them to the store cleanly.
