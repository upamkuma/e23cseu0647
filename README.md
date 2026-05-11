# Afford Medical Backend Assessment

This repository contains the completed backend evaluation tasks for the Afford Medical Campus Hiring Assessment. 

## Project Structure

* **`logging_middleware/`**: Contains the custom logger (`logger.js`) that sends logs directly to the evaluation API. As per the assessment rules, `console.log` has been strictly avoided in the main code, and all logs are routed through this middleware.
* **`vehicle_maintenance_scheduler/`**: Contains `scheduler.js`, which implements the 0/1 Knapsack dynamic programming algorithm to maximize the maintenance impact score for vehicles across 5 different depots, keeping strict adherence to their mechanic-hour constraints.
* **`notification_app_be/`**: Contains `priority_inbox.js`, which implements a Max-Heap data structure to efficiently rank and retrieve the top 10 most critical student notifications based on a weighted formula of category and recency.
* **`notification_system_design.md`**: Contains the detailed design documentation and pseudocode answering the architectural questions for Stages 1 through 6.

## How to Run

Before running the scripts, make sure you have the required dependencies installed:

```bash
npm install
```

### 1. Vehicle Maintenance Scheduler
To execute the vehicle scheduling algorithm:
```bash
node vehicle_maintenance_scheduler/scheduler.js
```

### 2. Priority Inbox Microservice
To execute the notification priority algorithm:
```bash
node notification_app_be/priority_inbox.js
```

## Technologies Used
* Node.js
* Axios (for API communication)
* Custom implementation of Data Structures (Max-Heap) and Algorithms (0/1 Knapsack)
