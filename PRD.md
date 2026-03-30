# Project Requirements Document (PRD)

## Project Title
**An Intelligent Order and Delivery Management System**

## Goal
Develop an Order and Delivery Management System (ODMS) that eliminates manual input friction in commercial kitchens using a Voice-Activated Kitchen Display System (KDS) and optimizes driver routes dynamically using predictive heatmaps.

---

## 1. Technology Stack

The project will utilize a modern, open-source three-tier architecture:

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React.js (SPA framework), Material-UI (Component Library), Leaflet.js (Mapping), Web Speech API (Native Browser Voice Recognition) |
| **Backend** | Python Flask (API Server), Google OR-Tools (Routing Solver), SQLAlchemy (ORM) |
| **Database** | PostgreSQL (Relational Data & Spatial Queries) |
| **Data Processing** | Python Pandas (for processing the open-source Amazon Delivery Dataset) |
| **Testing** | Pytest (Backend), Jest (Frontend), Postman (API Endpoints), Selenium (E2E Testing) |

---

## 2. Modular Folder Structure

To ensure maintainability and separation of concerns, initialize the repository with the following flat, modular structure:

```
frontend/          Contains the React.js application, Material-UI components, and Web Speech API hooks
backend/           Contains the Python Flask API, routing logic, and OR-Tools implementation
database/          Contains PostgreSQL schemas, SQLAlchemy models, and database migration scripts
data_pipeline/     Contains the ETL (Extract, Transform, Load) scripts to process the Amazon dataset
tests/             Contains sub-folders for Jest (frontend), Pytest (backend), and Selenium tests
```

---

## 3. Core Functionalities & Developer Instructions

### A. Voice-Activated Kitchen Display System (KDS)

This module replaces touchscreens with a Hands-Free Voice User Interface (VUI).

**Implementation Requirements:**

1. Integrate the native **Web Speech API** directly into the React browser app to process audio locally and reduce latency.

2. Implement a visual **microphone icon** that flashes when the system is actively listening.

3. Program the system to listen for the specific phrase pattern: **[System] + [Order ID] + [Status]**.

4. Implement a **Confidence Threshold Protocol**: 
   - If the API's confidence score is below **0.8**, the system must reject the command and audibly prompt, *"I didn't catch that, please repeat."*

5. Implement a **Confirmation Loop**: 
   - If the score is above the threshold, display *"Order [ID] Ready?"* on screen and require the user to say *"Confirm"* before updating the database.

---

### B. Manager Dashboard & Predictive Heatmaps

This module provides immediate business intelligence using historical logistics data.

**Implementation Requirements:**

1. Build the interactive dashboard interface using **Leaflet.js** and the **react-leaflet-heatmap-layer** component.

2. Implement a **toggle switch** allowing the manager to alternate between:
   - **"Live View"** (current active orders)
   - **"Predictive View"** (historical hotspots)

3. Write optimized **SQL aggregation queries** on the Flask backend to cluster the actual historical coordinates from the Amazon dataset.

4. Synchronize views in **real-time** (using simulated WebSockets or polling) so the map updates instantly when a kitchen command is confirmed.

---

### C. Route Optimization & Driver Allocation

This is the decision-making engine of the platform, utilizing an Event-Driven Architecture.

**Implementation Requirements:**

1. Integrate **Google OR-Tools** to solve the Vehicle Routing Problem (VRP).

2. Configure the solver to use the **"Path Cheapest Arc"** strategy for an initial rapid solution.

3. Apply the **"Guided Local Search" (GLS)** metaheuristic to refine the route and escape local minima.

4. Ensure the solver is triggered **dynamically and instantly** by the Voice-Activated KDS whenever an order status changes to *"Ready"*.

5. Program the logic to identify available drivers, assigning the **closest driver to the food waiting the longest** to minimize **Total Arrival Time (TAT)**.

---

### D. Data Ingestion & Replay Engine

This ensures realistic testing conditions without manual data entry.

**Implementation Requirements:**

1. Build an **ETL script** using Pandas to ingest the **Amazon Last-Mile Logistics Dataset**.

2. Filter the dataset to isolate a **"Single Store Cluster"** to mimic a local takeaway environment.

3. Develop a **Historical Data Replay** script that simulates incoming orders in real-time based on their **Order_Timestamp** to trigger the Voice AI and populate the heatmap.

---

## 4. Development Timeline (Execution Phase)

**Note:** All research and proposal phases have been bypassed. The timeline begins directly at architectural setup and UI development.

### Sprint 1: Foundation & UI Skeleton (Weeks 1-3)

- Set up the GitHub repository and modular folder structure.
- Develop the backend API structure and design the PostgreSQL database schema.
- Build the ETL Data Pipeline to clean, filter, and load the Amazon dataset into the database.
- Develop the base React.js UI skeleton for both the Kitchen View and the Manager Dashboard.

### Sprint 2: Core Algorithm & Voice Integration (Weeks 4-7)

- Implement the Web Speech API in the frontend and build the Confidence Threshold and Confirmation Loop logic.
- Implement the initial Route Optimization algorithm using Google OR-Tools in the Flask backend.
- Connect the confirmed Voice Trigger from the frontend to dynamically restart the VRP solver on the backend.

### Sprint 3: Visualization & Advanced Features (Weeks 8-10)

- Implement the Leaflet.js Heatmap Module on the frontend.
- Write the SQL aggregation scripts on the backend to feed historical order clusters to the heatmap.
- Implement the "Live" vs. "Predictive" toggle switch and real-time frontend/backend synchronization.

### Sprint 4: Testing & System Polish (Weeks 11-14)

- Write and execute Pytest (backend) and Jest (frontend) unit tests.
- Conduct specific **"Noise Robustness Tests"** on the Voice AI to calibrate the confidence threshold against simulated kitchen noise (70dB+).
- Run full Data Replay simulations to measure logistics efficiency metrics (Total Travel Time, Driver Idle Time).
- Complete end-to-end testing using Selenium.

---

## Key Performance Indicators (KPIs)

- **Voice Recognition Accuracy**: Target ≥95% command recognition rate with confidence ≥0.8
- **Total Arrival Time (TAT)**: Minimize average delivery time through optimized routing
- **Driver Idle Time**: Reduce downtime between deliveries
- **Total Travel Time**: Optimize route efficiency to reduce overall travel distance/time
- **System Response Time**: Voice command to database update <2 seconds
- **Heatmap Accuracy**: Historical prediction accuracy ≥85% for order clustering

---

## Success Criteria

1. Voice-Activated KDS successfully processes commands hands-free with minimal errors in noisy environments (70dB+).
2. Route optimization algorithm demonstrates measurable improvements in TAT and driver efficiency compared to baseline manual routing.
3. Predictive heatmaps accurately identify high-demand zones based on historical data.
4. System handles concurrent operations (multiple voice commands, real-time map updates) without performance degradation.
5. All modules pass unit, integration, and end-to-end tests with ≥90% code coverage.

---

*Document Version: 1.0*  
*Last Updated: February 27, 2026*
