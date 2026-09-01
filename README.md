# Fleet Management Dashboard

A full-stack React and Node.js application for monitoring and managing a simulated fleet of robots.

## Tech Stack
- **Frontend**: React, Vite, Ant Design, Redux Toolkit, Redux Saga, Recharts
- **Backend**: Node.js, Express, WebSocket (ws), Prisma ORM
- **Database**: PostgreSQL (AWS RDS / Neon)

## Features
- **Real-time Canvas Map**: Visualizes robot positions dynamically on the site layout.
- **WebSocket Streaming**: Live updates for robot positions and statuses (5s intervals).
- **Dual-Write Architecture**: Fast in-memory state for live dashboard, async Prisma writes for historical data.
- **Trend Analysis**: Recharts-based visualization of fleet status over time.
- **Dynamic Configuration**: Change fleet size and update intervals on the fly.

## Getting Started (Local Development)

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database

### 1. Database Setup
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/fleet_db"
PORT=3001
FLEET_SIZE=8
UPDATE_INTERVAL_MS=5000
AUTH_TOKEN=fleet-admin-token
```

### 2. Backend Setup
```bash
cd server
npm install
npx prisma db push
npm start
```
The server will start on `http://localhost:3001`.

### 3. Frontend Setup
```bash
cd dashboard
npm install
npm run dev
```
The dashboard will be available at `http://localhost:5173`.

## Architecture Highlights
- **State Management**: Redux Saga handles the complex WebSocket lifecycle (reconnects, heartbeats).
- **Performance**: The frontend uses HTML5 Canvas for the SiteMap instead of DOM nodes, ensuring smooth performance even with 800+ robots.
- **Resilience**: The backend uses an in-memory `FleetState` store. The dashboard reads from this store (microseconds), completely bypassing the database for live data.

## Deployment (AWS)
- **Database**: Amazon RDS PostgreSQL (db.t3.micro)
- **Backend**: Amazon EC2 (t3.micro) running PM2
- **Frontend**: Amazon S3 + CloudFront
