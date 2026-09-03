# System Architecture

## System Diagram

![Hand-drawn system architecture diagram](./System%20Diagram.jpg)

The system is built in three main layers:

1. **Simulator (The Virtual Warehouse):** A program that acts like a real warehouse full of robots. It constantly calculates where each robot is, how much battery it has, and what it is doing.
2. **Backend Server (The Traffic Controller):** This receives all the updates from the robots in real-time. It remembers the current state of every robot, saves a history of their actions to a database, and instantly passes the latest updates to anyone looking at the dashboard.
3. **Frontend Dashboard (The Operator Screen):** A visual interface that receives continuous updates from the server. It draws the warehouse map, plots the robots on it, and shows performance charts and status tables.

---

## How Data Flows: From a Robot Moving to the Screen Updating

### Step 1 — Simulator tick
Every few seconds, the simulator calculates the next step for all the robots. It updates their locations, drains their batteries slightly, and decides if they should change what they are doing (like going from "working" to "charging"). Once the math is done, it bundles all this new information together and sends it out.

### Step 2 — FleetService ingests the batch
The server receives this bundle of information and does two things simultaneously:
- It updates its own memory so it always knows exactly where every robot is right now.
- It puts a copy of the update into a queue to be saved into the database (so we have a permanent historical record).

### Step 3 — WebSocket broadcast
The server then takes the newest information and broadcasts it over the network to all open dashboard screens.

### Step 4 — Dashboard WebSocket saga receives
The dashboard receives the broadcast from the server and figures out what kind of message it is (like a full snapshot or just a minor update). 

### Step 5 — Redux store updates
The dashboard updates its internal data memory to match exactly what the server just sent over.

### Step 6 — Canvas renders
Finally, it redraws the screen based on the new data. It moves the robots on the map, updates the tables, and adjusts the charts. This entire process happens so fast that the screen updates almost instantly after the simulator finishes its math.

---

## How We Handle Problems

### What if a robot breaks down?
The simulator is programmed to occasionally simulate real-world problems. A working robot might suddenly report an "error" or get "blocked." 
When this happens, the dashboard immediately highlights the robot with a red glowing ring on the map, bumps up the "Critical" alert counter, and allows the operator to click on the robot to see exactly when and why it stopped working.

### What if an update arrives late?
Sometimes network hiccups happen. The server is smart enough to look at the exact time an update was created. If it receives an update that is older than the information it already has for that robot, it simply throws the late message away. Also, if the server hasn't heard from a robot in a while, it automatically tags that robot as "stale" or unresponsive on the dashboard so operators know it's missing.

### What if the dashboard loses connection?
If the internet cuts out or the server restarts, the dashboard will show a "Disconnected" badge. Behind the scenes, it will continuously try to reconnect. As soon as the connection is restored, the server immediately sends over a complete, fresh snapshot of the entire warehouse so the dashboard is instantly back in sync without having to piece together what it missed.

---

## Scaling Up: What to Change for 10x More Robots

Right now, the system handles hundreds of robots smoothly. But if we wanted to jump to thousands of robots, we would make a few key upgrades:

1. **Faster Database Saving:** Currently, the system saves the robot history into the database in a way that can become a bottleneck at a massive scale. The very first fix would be to change how it saves to the database so it writes all the records in one massive bulk action, rather than doing them individually inside a batch.
2. **Smarter Network Traffic:** Instead of sending every detail about every robot every time, the server could be upgraded to only send the specific details that actually changed.
3. **Upgraded Server Memory:** We would move the server's memory out into a dedicated, high-speed storage system. This would allow us to run multiple servers side-by-side to share the heavy workload of managing thousands of robots.
