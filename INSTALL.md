# PerimeterPulse — Complete Installation & Deployment Guide

> Agent-Based PC Health & Location Monitoring System for IT Inventory Management

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Requirements](#system-requirements)
3. [Server Deployment (Docker)](#server-deployment-docker)
4. [Database Setup (MySQL + InfluxDB)](#database-setup)
5. [API Key Management](#api-key-management)
6. [Agent Installation](#agent-installation)
   - [Windows Agent](#windows-agent)
   - [Lubuntu / Linux Agent](#lubuntu--linux-agent)
7. [Dashboard Access](#dashboard-access)
8. [Environment Variables Reference](#environment-variables-reference)
9. [Network Diagnostics Explained](#network-diagnostics-explained)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌──────────────────┐     HTTPS (JSON)     ┌─────────────────────────┐
│  Golang Agent    │ ──────────────────→  │  PerimeterPulse Server  │
│  (Windows/Linux) │     Every 60s        │  (Node.js / Nitro)      │
│                  │                      │                         │
│  • CPU/RAM/Disk  │                      │  ┌──────────┐ ┌───────┐ │
│  • WiFi/Network  │                      │  │  MySQL   │ │InfluxDB│ │
│  • SMART Health  │                      │  │(Assets)  │ │(Metrics)│ │
│  • GPS/WiFi Loc  │                      │  └──────────┘ └───────┘ │
│  • Offline Buffer│                      │                         │
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

---

## System Requirements

### Server (Docker Host)

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB SSD |
| Docker | 24.0+ | Latest |
| Docker Compose | 2.0+ | Latest |

### Agent (Remote PCs)

| OS | Requirements |
|----|-------------|
| **Windows 10/11** | Go 1.21+, PowerShell 5.1+ |
| **Lubuntu 22.04+** | Go 1.21+, systemd |

---

## Server Deployment (Docker)

### Step 1: Clone / Prepare the project

```bash
# Ensure you have the full project directory:
#  perimeterpulse/
#  ├── docker-compose.yml
#  ├── Dockerfile
#  ├── .env.example
#  ├── server/
#  │   ├── db/schema.mysql.sql
#  │   └── ... (API routes)
#  ├── src/  (React frontend)
#  └── agent/ (Golang agent — compiled separately)
```

### Step 2: Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your secrets:

```env
# MySQL
MYSQL_ROOT_PASSWORD=ChooseAStrongRootPassword!
MYSQL_USER=perimeterpulse
MYSQL_PASSWORD=ChooseAStrongPassword!
MYSQL_DATABASE=perimeterpulse

# InfluxDB
INFLUX_USER=admin
INFLUX_PASSWORD=ChooseAStrongPassword!
INFLUX_ORG=perimeterpulse
INFLUX_BUCKET=perimeterpulse
INFLUX_TOKEN=GenerateARandomTokenHere

# JWT Secret (generate with: openssl rand -hex 32)
NITRO_JWT_SECRET=your-random-64-char-hex-string
```

### Step 3: Start services

```bash
docker compose up -d
```

This starts:
- `perimeterpulse-mysql` — MySQL 8.4 on port 3306
- `perimeterpulse-influxdb` — InfluxDB 2.7 on port 8086
- `perimeterpulse-backend` — Nitro/Express API on port 3000

### Step 4: Initialize MySQL Schema

The schema file is auto-loaded on first run. If you need to run it manually:

```bash
docker compose exec -T mysql mysql -u perimeterpulse -p"${MYSQL_PASSWORD}" perimeterpulse < server/db/schema.mysql.sql
```

### Step 5: Seed Default Users & API Key

The schema creates default users (`admin`/`admin123` and `viewer`/`viewer123`) with placeholder password hashes. Update them with real bcrypt hashes:

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

  // Update admin password
  const adminHash = bcrypt.hashSync('admin123', 10);
  await c.execute('UPDATE users SET password_hash=? WHERE username=?', [adminHash, 'admin']);

  // Update viewer password
  const viewerHash = bcrypt.hashSync('viewer123', 10);
  await c.execute('UPDATE users SET password_hash=? WHERE username=?', [viewerHash, 'viewer']);

  // Create default API key for agents
  const rawKey = 'ppulse-sk-a1b2c3d4e5f6g7h8';
  const keyHash = bcrypt.hashSync(rawKey, 10);
  await c.execute(
    'INSERT INTO api_keys (key_prefix, key_hash, label) VALUES (?, ?, ?)',
    ['ppulse-s', keyHash, 'Default Agent Key']
  );

  console.log('Admin password set: admin123');
  console.log('Viewer password set: viewer123');
  console.log('Agent API Key:', rawKey);
  await c.end();
})();
"
```

> ⚠️ **Save the API key** — you'll need it when deploying agents.

### Step 6: Verify

```bash
# Check all services are healthy
docker compose ps

# Test API
curl http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## Database Setup

### MySQL Tables

| Table | Purpose |
|-------|---------|
| `users` | Dashboard login accounts (admin/viewer roles) |
| `api_keys` | Agent authentication keys (bcrypt-hashed) |
| `assets` | PC inventory — hostname, OS, CPU, RAM, disk, WiFi, IP, location |

### InfluxDB Measurements

| Measurement | Fields |
|------------|--------|
| `agent_metrics` | cpu_percent, ram_percent, storage_percent, network_status, network_latency_ms, gateway_reachable, dns_working, internet_reachable |
| `agent_location` | latitude, longitude, accuracy_meters, source (os/geoip) |

---

## API Key Management

### Via Dashboard (Admin)

1. Login as admin at `http://your-server:3000/login`
2. Click **API Keys** in the sidebar
3. Click **Create Key** — the raw key is shown once

### Via CLI

```bash
curl -X POST http://localhost:3000/api/api-keys/create \
  -H "Authorization: Bearer $(your-jwt-token)" \
  -H "Content-Type: application/json" \
  -d '{"label":"Production Agents"}'
```

---

## Agent Installation

### Windows Agent

#### 1. Install Go

Download and install Go 1.21+ from https://go.dev/dl/

```powershell
# Verify installation
go version
```

#### 2. Build the agent

```powershell
cd agent\
go mod tidy
go build -ldflags="-s -w" -o pulse-agent.exe .
```

This produces `pulse-agent.exe` (~10 MB, no dependencies).

#### 3. Test run

```powershell
.\pulse-agent.exe `
  --server https://your-server.com `
  --apikey ppulse-sk-a1b2c3d4e5f6g7h8 `
  --hostname MY-WINDOWS-PC
```

#### 4. Install as Windows Service (auto-start)

Create directory and copy binary:

```powershell
New-Item -ItemType Directory -Path "C:\Program Files\PerimeterPulse" -Force
Copy-Item pulse-agent.exe "C:\Program Files\PerimeterPulse\"
```

Create scheduled task (runs on startup as SYSTEM):

```powershell
$Action = New-ScheduledTaskAction `
  -Execute "C:\Program Files\PerimeterPulse\pulse-agent.exe" `
  -Argument '--server https://your-server.com --apikey ppulse-sk-a1b2c3d4e5f6g7h8'

$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
$Settings = New-ScheduledTaskSettingsSet `
  -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName "PerimeterPulseAgent" `
  -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings `
  -Description "PerimeterPulse PC Health Monitor" `
  -Force

Start-ScheduledTask -TaskName "PerimeterPulseAgent"
```

> **Location permissions**: Ensure "Location services" is ON in Windows Settings → Privacy → Location.

---

### Lubuntu / Linux Agent

#### 1. Install dependencies

```bash
sudo apt update
sudo apt install -y golang-go geoclue-2.0 smartmontools wireless-tools network-manager
```

#### 2. Build the agent

```bash
cd agent/
go mod tidy
CGO_ENABLED=0 go build -ldflags="-s -w" -o pulse-agent .
```

#### 3. Test run

```bash
./pulse-agent \
  --server https://your-server.com \
  --apikey ppulse-sk-a1b2c3d4e5f6g7h8 \
  --hostname my-lubuntu-pc
```

#### 4. Install as systemd service

```bash
# Copy binary
sudo mkdir -p /opt/perimeterpulse
sudo cp pulse-agent /opt/perimeterpulse/
sudo chmod +x /opt/perimeterpulse/pulse-agent
```

Create service file:

```bash
sudo tee /etc/systemd/system/pulse-agent.service << 'EOF'
[Unit]
Description=PerimeterPulse Monitoring Agent
After=network-online.target
Wants=network-online.target geoclue.service

[Service]
Type=simple
ExecStart=/opt/perimeterpulse/pulse-agent \
  --server https://your-server.com \
  --apikey ppulse-sk-a1b2c3d4e5f6g7h8
Restart=always
RestartSec=30
User=nobody
Environment="HOME=/tmp"

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pulse-agent
sudo systemctl status pulse-agent
```

#### 5. Configure GeoClue (Location)

On Lubuntu, GeoClue needs configuration to allow the agent to access location:

```bash
sudo tee /etc/geoclue/geoclue.conf << 'EOF'
[agent]
allowed=true

[perimeterpulse]
allowed=true
users=nobody
EOF
```

---

## Dashboard Access

1. Open `http://your-server:3000` in a browser
2. Login with:
   - **Admin**: `admin` / `admin123`
   - **Viewer**: `viewer` / `viewer123`
3. The dashboard shows:
   - **Dashboard** — Stats cards, mini-map, asset list
   - **Geo Map** — Full-screen map with live agent pins
   - **Assets** — Searchable, filterable asset grid
   - **Asset Detail** — Time-series charts, hardware specs, network diag

### Change Passwords

After first login, update passwords via MySQL:

```bash
docker compose exec backend node -e "
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host:'mysql',user:'perimeterpulse',password:'perimeterpulse',database:'perimeterpulse'
  });
  const hash = bcrypt.hashSync('your-new-password', 10);
  await c.execute('UPDATE users SET password_hash=? WHERE username=?', [hash, 'admin']);
  console.log('Password updated');
  await c.end();
})();
"
```

---

## Environment Variables Reference

### Backend (Nitro Server)

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | `localhost` | MySQL hostname |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `perimeterpulse` | MySQL username |
| `MYSQL_PASSWORD` | `perimeterpulse` | MySQL password |
| `MYSQL_DATABASE` | `perimeterpulse` | MySQL database name |
| `DATABASE_URL` | — | Alternative: `mysql://user:pass@host:port/db` |
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB HTTP endpoint |
| `INFLUXDB_TOKEN` | `perimeterpulse-token` | InfluxDB auth token |
| `INFLUXDB_ORG` | `perimeterpulse` | InfluxDB organization |
| `INFLUXDB_BUCKET` | `perimeterpulse` | InfluxDB bucket name |
| `NITRO_JWT_SECRET` | *(must change)* | JWT signing secret (64 hex chars) |
| `NITRO_PORT` | `3000` | Server listen port |

### Docker Compose Additional

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_ROOT_PASSWORD` | `rootpassword` | MySQL root password |

---

## Network Diagnostics Explained

The agent performs a **4-stage network diagnostic** every heartbeat:

```
┌─────────────────────────────────────────────────┐
│ Stage 1: Interface Check                        │
│   Are any non-loopback interfaces up with IPs?  │
│   ↓ Yes → continue                              │
│   ↓ No  → status = "down"                       │
├─────────────────────────────────────────────────┤
│ Stage 2: Gateway Reachability (LAN Check)       │
│   Can we TCP-connect to the default gateway?    │
│   ↓ Yes → gateway_reachable = true              │
│   ↓ No  → status = "limited" (local only)       │
├─────────────────────────────────────────────────┤
│ Stage 3: DNS Resolution                         │
│   Can we resolve google.com?                    │
│   ↓ Yes → dns_working = true                    │
│   ↓ No  → DNS issue, may still have internet    │
├─────────────────────────────────────────────────┤
│ Stage 4: Internet Connectivity                  │
│   Can we TCP-connect to 8.8.8.8:53?             │
│   ↓ Yes → internet_reachable = true             │
│   ↓ No  → status = "degraded" (LAN ok, WAN down)│
├─────────────────────────────────────────────────┤
│ Final Status:                                   │
│   "up"      — GW ✓ + DNS ✓ + Internet ✓         │
│   "degraded"— GW ✓ but no internet              │
│   "limited" — Interface up but no gateway       │
│   "down"    — No active network interface       │
└─────────────────────────────────────────────────┘
```

These diagnostics appear in the dashboard under each asset's network info section. The InfluxDB metrics also track `gateway_reachable`, `dns_working`, and `internet_reachable` as boolean fields for historical analysis.

---

## Troubleshooting

### Agent not appearing in dashboard

1. Check agent logs:
   ```bash
   # Linux
   journalctl -u pulse-agent -f
   
   # Windows
   Get-ScheduledTaskInfo -TaskName PerimeterPulseAgent
   ```

2. Verify API key is correct and active:
   ```bash
   docker compose exec mysql mysql -u perimeterpulse -pperimeterpulse perimeterpulse \
     -e "SELECT id, key_prefix, label, is_active, last_used_at FROM api_keys;"
   ```

3. Test connectivity from agent to server:
   ```bash
   curl -v https://your-server.com/api/agent/heartbeat
   ```

### MySQL connection refused

```bash
docker compose logs mysql
# Check if MySQL is healthy
docker compose ps mysql
```

### InfluxDB not receiving data

```bash
# Check InfluxDB health
curl http://localhost:8086/health

# View metrics via UI
open http://localhost:8086  (login: admin / your-influx-password)
```

### Dashboard shows "No agents connected"

1. Verify backend is running: `docker compose ps backend`
2. Check backend logs: `docker compose logs backend`
3. Ensure MySQL has the schema: `docker compose exec mysql mysql -u perimeterpulse -pperimeterpulse perimeterpulse -e "SHOW TABLES;"`
4. Check agent is running and sending data (see agent logs)

### Reset everything

```bash
docker compose down -v   # Removes all data volumes
docker compose up -d     # Fresh start
# Then re-run the schema and seed users as described above
```

---

## Security Notes

- 🔐 **Change all default passwords** before production use
- 🔐 **Generate a strong JWT secret**: `openssl rand -hex 32`
- 🔐 **Use HTTPS** with a reverse proxy (nginx, Caddy) in production
- 🔐 **Rotate API keys** periodically
- 🔐 **Restrict firewall** to only allow agent IPs to the API port
- 🔐 **Backup MySQL and InfluxDB** volumes regularly

---

## File Structure

```
perimeterpulse/
├── docker-compose.yml          # Production deployment stack
├── Dockerfile                  # Backend container build
├── .env.example                # Environment template
├── server/
│   ├── db/
│   │   ├── schema.mysql.sql    # MySQL schema
│   │   ├── mysql.ts            # MySQL connection + bcrypt
│   │   └── influx.ts           # InfluxDB read/write
│   ├── middleware/
│   │   └── auth.ts             # JWT + API key auth
│   └── routes/api/
│       ├── auth/               # Login, session
│       ├── agent/              # Register, heartbeat
│       ├── assets/             # Asset CRUD + metrics
│       └── api-keys/           # Key management
├── agent/                      # Golang monitoring agent
│   ├── main.go
│   ├── go.mod
│   ├── collector/
│   │   ├── collector.go        # CPU/RAM/Disk/Uptime
│   │   ├── network.go          # WiFi/IP/Speed
│   │   ├── location.go         # OS + GeoIP location
│   │   ├── location_windows.go # Windows Geolocator stub
│   │   ├── location_linux.go   # GeoClue2 via D-Bus
│   │   ├── smart.go            # SMART disk health
│   │   └── diag.go             # Network diagnostics
│   ├── buffer/
│   │   └── buffer.go           # Offline JSONL buffer
│   └── client/
│       └── client.go           # HTTPS API client
└── src/                        # React frontend
    ├── lib/
    │   ├── types.ts
    │   ├── api.ts
    │   └── auth.tsx
    ├── components/
    │   ├── layout/AppLayout.tsx
    │   └── dashboard/          # StatsCards, MapView, etc.
    └── pages/
        ├── Index.tsx           # Dashboard
        ├── Map.tsx             # Geo map
        ├── Assets.tsx          # Asset list
        ├── AssetDetail.tsx     # Detail + charts
        └── Login.tsx           # Login page
```
