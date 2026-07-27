# HomeTracker 

HomeTracker is a premium, real-time family location-sharing and ETA prediction web application. It allows families to set up a private circle, register their home location, and monitor real-time distances and ETA calculations for circle members on an interactive map dashboard.

---

## User Guide (For Families & End-Users)

### What is HomeTracker?
HomeTracker helps you stay connected with your loved ones. It provides a secure, private dashboard where family members can see who is at home, who is on their way, and exactly when they are expected to arrive.

### Key Features
*   **Private Family Circles:** Create a unique family group or join an existing one using a secure invite code.
*   **Live Location Sharing:** Safely share your current coordinates with family members within your circle.
*   **Predictive Routing & ETAs:** Automatically calculates distance (in kilometers) and keeps everyone updated on arrival times.
*   **Instant Notifications:** Get alerts when a family member arrives home or goes offline.
*   **Beautiful Dashboard:** Interactive live-updating map with smooth micro-animations.

### Getting Started (3-Step Guide)
1.  **Register or Sign In:** Create an account. You can choose to create a new family circle or input an invite code to join an existing one.
2.  **Set Your Home Base:** If you are the head of the household, set the home address and target arrival times on the settings panel.
3.  **Share & Track:** Keep the dashboard open on your device to share your GPS position and view everyone else's live status.

---


## Local Development Setup

To run the application locally, follow these steps:

### 1. Prerequisites
Ensure you have **Node.js (v18+)** installed.

### 2. Environment Configuration
Create a `.env.local` file in the root directory and add:
```env
TURSO_DATABASE_URL="your-sqlite-or-turso-db-url"
TURSO_AUTH_TOKEN="your-turso-auth-token"
```

### 3. Installation
Install project dependencies:
```bash
npm install
```

### 4. Running the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser to access the application.
