<div align="center">

<img src="https://img.shields.io/badge/Agent-Golang-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go Agent" />
<img src="https://img.shields.io/badge/Backend-Node.js%20%2F%20Nitro-339933?style=flat-square&logo=node.js&logoColor=white" alt="Backend" />
<img src="https://img.shields.io/badge/Frontend-React%20%2F%20TypeScript-61DAFB?style=flat-square&logo=react&logoColor=black" alt="Frontend" />
<img src="https://img.shields.io/badge/Database-MySQL%208-4479A1?style=flat-square&logo=mysql&logoColor=white" alt="MySQL" />
<img src="https://img.shields.io/badge/Maps-Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white" alt="Leaflet" />
<br /><br />

# 📡 PerimeterPulse

**Agent-Based PC Health & Location Monitoring System**

*Track your remote PCs in real-time — hardware metrics, WiFi networks, disk health, GPS locations, and network diagnostics — all in one dashboard.*

[Features](#-features) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [Agent Setup](#-agent-setup) · [Dashboard](#-dashboard) · [Configuration](#-configuration)

</div>

---

## ✨ Features

### 🖥️ Real-Time Hardware Monitoring
- **CPU / RAM / Disk** usage tracked every 60 seconds with time-series charts
- **SMART disk health** monitoring with temperature readings
- Historical data with selectable time ranges (1h, 6h, 24h, 7d)

### 📍 GPS Location Tracking
- **Real-time map** with color-coded pins per agent status (online/offline/warning/critical)
- Location sources: **OS Geolocator** (Windows) / **GeoClue2** (Linux) / **GeoIP fallback**
- Full location history with timeline view

### 🌐 Network Diagnostics
- **4-stage network check** on every heartbeat:
  1. Interface status check
  2. Gateway reachability (LAN)
  3. DNS resolution test
  4. Internet connectivity (8.8.8.8)
- WiFi SSID, signal strength (dBm), link speed, IP & gateway tracking
- Ping latency monitoring to 8.8.8.8

### 🔐 Security & Access Control
- **JWT-based authentication** with 24h token expiry
- **Role-based access**: Admin (full control) / Viewer (read-only)
- **API key auth** for agents with bcrypt-hashed keys
- Password change with strength indicator

### 🗺️ Interactive Dashboard
- **GeoMap** — Full-screen Leaflet map with live agent positions
- **Stats Overview** — Total assets, online/offline counts, averages
- **Asset Grid** — Searchable, filterable cards with hardware specs
- **Asset Detail** — Time-series charts, network info, error logs, location map
- **Dark / Light theme** with smooth transitions

### 👥 Multi-User Management
- Admin can create and delete user accounts
- User profile with last login tracking
- Per-user session management

### 📦 Agent Features
- **Offline buffering** — Heartbeats cached locally when server is unreachable
- **Auto-registration** — Agents register themselves on first contact
- **Lightweight** — Single ~10 MB binary, no runtime dependencies
- **Cross-platform** — Windows (scheduled task) & Linux (systemd service)

---

## 🏗 Architecture

```
┌──────────────────┐     HTTPS (JSON)     ┌─────────────────────────┐
│  Golang Agent    │ ──────────────────→  │  PerimeterPulse Server  │
│  (Windows/Linux) │     Every 60s        │  (Node.js / Nitro)      │
│                  │                      │                         │
│  • CPU/RAM/Disk  │                      │  ┌──────────┐           │
│  • WiFi/Network  │                      │  │  MySQL   │           │
│  • SMART Health  │                      │  │(Assets)  │           │
│  • GPS/WiFi Loc  │                      │  │(Metrics) │           │
│  • Offline Buffer│                      │  │(Locations)│           │
└──────────────────┘                      └──────────┬──────────────┘
                                                     │
                                          ┌──────────▼──────────────┐
                                          │  React Dashboard (Web)   │
                                          │  • Geomap (Leaflet)      │
                                          │  • Time-Series Charts    │
                                          │  • Asset Management      │
                                          │  • Role-Based Access     │
                                          └─────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Agent** | Golang 1.21+ (single binary) |
| **Backend** | Nitro v3 (Node.js server) |
| **Database** | MySQL 8.4 |
| **Frontend** | React 19 + TypeScript |
| **UI Library** | shadcn/ui + Tailwind CSS |
| **Charts** | Recharts |
| **Maps** | Leaflet + OpenStreetMap |
| **Auth** | JWT (jose) + bcrypt |
| **Deployment** | Docker + Docker Compose |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose v2.0+
- 2+ GB RAM, 20+ GB disk

### 1. Clone & Configure

```bash
git clone https://github.com/your-username/perimeterpulse.git
cd perimeterpulse

cp .env.example .env
```

Edit `.env`:

```env
# MySQL
MYSQL_ROOT_PASSWORD=YourStrongRootPassword!
MYSQL_USER=perimeterpulse
MYSQL_PASSWORD=YourStrongPassword!
MYSQL_DATABASE=perimeterpulse

# JWT Secret (generate: openssl rand -hex 32)
NITRO_JWT_SECRET=your-random-64-char-hex-string
```

### 2. Start Services

```bash
docker compose up -d
```

This starts:
- `perimeterpulse-mysql` — MySQL 8.4 on port 3306
- `perimeterpulse-backend` — API + Dashboard on port 3000

### 3. Seed Default Users

```bash
docker compose exec backend node -e "
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: 'mysql', user: 'perimeterpulse',
    password: process.env.MYSQL_PASSWORD || 'perimeterpulse',
    database: 'perimeterpulse'
  });
  await c.execute('UPDATE users SET password_hash=? WHERE username=?', [bcrypt.hashSync('admin123', 10), 'admin']);
  await c.execute('UPDATE users SET password_hash=? WHERE username=?', [bcrypt.hashSync('viewer123', 10), 'viewer']);
  const rawKey = 'ppulse-sk-a1b2c3d4e5f6g7h8';
  await c.execute('INSERT INTO api_keys (key_prefix, key_hash, label) VALUES (?, ?, ?)',
    ['ppulse-s', bcrypt.hashSync(rawKey, 10), 'Default Agent Key']);
  console.log('Admin: admin / admin123');
  console.log('Viewer: viewer / viewer123');
  console.log('Agent API Key:', rawKey);
  await c.end();
})();
"
```

### 4. Access Dashboard

Open **http://localhost:3000** and login with `admin` / `admin123`

> ⚠️ **Change default passwords immediately after first login!**

---

## 🤖 Agent Setup

### Windows Agent

```powershell
# Build
cd agent\
go build -ldflags="-s -w" -o pulse-agent.exe .

# Test
.\pulse-agent.exe --server https://your-server.com --apikey ppulse-sk-a1b2c3d4e5f6g7h8

# Install as scheduled task (auto-start on boot)
$Action = New-ScheduledTaskAction -Execute "C:\PerimeterPulse\pulse-agent.exe" `
  -Argument '--server https://your-server.com --apikey ppulse-sk-a1b2c3d4e5f6g7h8'
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
Register-ScheduledTask -TaskName "PerimeterPulseAgent" -Action $Action `
  -Trigger $Trigger -Principal $Principal -Force
```

### Linux Agent (Lubuntu/Ubuntu)

```bash
# Install dependencies
sudo apt install -y golang-go geoclue-2.0 smartmontools wireless-tools

# Build
cd agent/
CGO_ENABLED=0 go build -ldflags="-s -w" -o pulse-agent .

# Install as systemd service
sudo cp pulse-agent /opt/perimeterpulse/
sudo tee /etc/systemd/system/pulse-agent.service << 'EOF'
[Unit]
Description=PerimeterPulse Monitoring Agent
After=network-online.target
[Service]
Type=simple
ExecStart=/opt/perimeterpulse/pulse-agent \
  --server https://your-server.com \
  --apikey ppulse-sk-a1b2c3d4e5f6g7h8
Restart=always
RestartSec=30
User=nobody
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now pulse-agent
```

---

## 📊 Dashboard

| View | Description |
|------|-------------|
| **Dashboard** | Stats cards, mini-map, asset list, system overview |
| **Geo Map** | Full-screen interactive map with agent pins |
| **Assets** | Searchable grid with status filters |
| **Asset Detail** | Hardware specs, time-series charts, network diagnostics, error logs |
| **API Keys** | Create and manage agent authentication keys (admin) |
| **Account** | Profile info, password change, user management (admin) |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | `localhost` | MySQL hostname |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `perimeterpulse` | MySQL username |
| `MYSQL_PASSWORD` | `perimeterpulse` | MySQL password |
| `MYSQL_DATABASE` | `perimeterpulse` | Database name |
| `DATABASE_URL` | — | Alternative connection string |
| `NITRO_JWT_SECRET` | *(required)* | JWT signing secret (64 hex chars) |
| `NITRO_PORT` | `3000` | Server listen port |

### Agent CLI Flags

| Flag | Description |
|------|-------------|
| `--server` | Server URL (e.g. `https://your-server.com`) |
| `--apikey` | API key for authentication |
| `--hostname` | Override auto-detected hostname |
| `--interval` | Heartbeat interval in seconds (default: 60) |

---

## 🔒 Security Notes

- 🔐 Change all default passwords before production use
- 🔐 Generate a strong JWT secret: `openssl rand -hex 32`
- 🔐 Use HTTPS with a reverse proxy (nginx, Caddy) in production
- 🔐 Rotate API keys periodically
- 🔐 Restrict firewall to only allow agent IPs to the API port
- 🔐 Backup MySQL volumes regularly

---

## 🛠 Development

```bash
# Install dependencies
npm install

# Start dev server (frontend + API)
npm run dev

# Build for production
npm run build
```

The dev server runs on `http://localhost:8080` with hot-reload for the frontend and auto-restart for API routes.

---

## 📁 Project Structure

```
perimeterpulse/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── nitro.config.ts
├── vite.config.ts
├── server/
│   ├── db/
│   │   ├── schema.mysql.sql        # Database schema
│   │   └── mysql.ts                # Connection pool + queries
│   ├── lib/
│   │   └── auth.ts                 # JWT + API key validation
│   └── routes/api/
│       ├── auth/                   # Login, password change
│       ├── agent/                  # Register, heartbeat
│       ├── assets/                 # CRUD, metrics, locations, errors
│       ├── api-keys/               # Key management
│       └── users/                  # User management
├── agent/                          # Golang monitoring agent
│   ├── main.go
│   ├── collector/                  # System metrics collectors
│   ├── buffer/                     # Offline buffering
│   └── client/                     # HTTP client
└── src/                            # React frontend
    ├── lib/                        # Types, API client, auth context
    ├── components/
    │   ├── layout/                 # AppLayout, ThemeToggle
    │   ├── dashboard/              # MapView, Charts, StatsCards
    │   └── ui/                     # shadcn/ui components
    └── pages/                      # Route pages
```

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for IT infrastructure monitoring**

</div>