# Smart Hook Backend 🧥📡

The **Smart Hook Backend** is a Node.js-based IoT hub designed to power a "Smart Hook" device (ESP32). It bridges the gap between hardware sensors and real-time public transport data, allowing users to receive live commute information the moment they interact with their physical hook (e.g., when a coat is removed).

## 🚀 Features

- **Device Management**: Register and manage multiple IoT devices.
- **Sensor Data Ingestion**: Webhook-based ingestion for sensor measurements (Pressure, IMU, etc.).
- **Live Transit Integration**: Real-time travel planning via the **Digitransit (HSL) API v2**.
- **Unified Hardware Endpoint**: A dedicated `status` endpoint optimized for ESP32 hardware to poll for live updates.
- **Security**: JWT-based authentication for user routes and secure device verification.
- **Real-time Communication**: WebSocket support for live data streaming.
- **Lightweight Storage**: High-performance SQLite database with WAL mode.

## 🛠 Tech Stack

- **Server**: Node.js, Express
- **Database**: SQLite (`better-sqlite3`)
- **API Communication**: Native `fetch`, GraphQL (Digitransit)
- **Auth**: JWT (`jsonwebtoken`), Bcrypt
- **Real-time**: WebSockets (`ws`)
- **Containerization**: Docker

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+) or Docker
- A Digitransit API Key (Get one at [digitransit.fi](https://digitransit.fi/en/developers/api-registration/))

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd smart-hook-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   DATABASE_PATH=./data/database.db
   JWT_SECRET=your-secure-secret
   DIGITRANSIT_API_KEY=your-api-key-here
   ```

### Running the App

**Using Node.js:**
```bash
npm start
```

**Using Docker:**
```bash
docker build -t smart-hook-backend .
docker run -p 3000:3000 -v $(pwd)/data:/app/data smart-hook-backend
```

## 🔌 API Endpoints

### Hardware (ESP32)
- `GET /api/device/v1/status/:uuid` — Returns live transit and device status.

### Webhooks
- `POST /api/webhook/sensor-data` — Ingest sensor telemetry from NodeRED/Devices.

### Authentication
- `POST /api/auth/register` — Create a new account.
- `POST /api/auth/login` — Get a JWT token.

### Device Management
- `POST /api/device/v1/add-device` — Register a new hook.
- `GET /api/device/v1/devices` — List all registered devices.

## 🛰 Transit Integration
The backend uses the **Digitransit GraphQL API** to calculate commute times based on the `origin` and `destination` coordinates configured for each device. The results are formatted specifically for small hardware screens.

## 🤝 Team
Developed by **DTAP Team 9**.
- **Traffic API**: Integrated live HSL routing and hardware status logic.
- **Weather API**: (In Progress) Integration for local weather forecasts.

## 📄 License
This project is licensed under the MIT License.
