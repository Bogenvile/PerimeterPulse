import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { MapView } from "@/components/dashboard/MapView";
import {
  ArrowLeft,
  Cpu,
  HardDrive,
  Wifi,
  Monitor,
  Laptop,
  Network,
  Thermometer,
  Disc,
  Signal,
  EthernetPort,
} from "lucide-react";
import type { ExtendedAsset, MetricsDataPoint, LocationDataPoint } from "@/lib/types";

const mockAssets: Record<string, ExtendedAsset> = {
  "1": {
    id: "1", agent_id: "agent-a1b2c3d4", hostname: "FACTORY-EDGE-01",
    os: "Windows 11", os_version: "10.0.22631", agent_version: "2.0.0",
    mac_addresses: ["00:1A:2B:3C:4D:5E"], ip_addresses: ["192.168.1.101", "fe80::1a2b"],
    cpu_model: "Intel Core i7-13700", cpu_cores: 16,
    ram_total_bytes: 17179869184, storage_total_bytes: 512110190592,
    disk_model: "Samsung 990 Pro 1TB", disk_type: "NVMe",
    disk_health_status: "ok", disk_temperature_c: 42,
    wifi_ssid: "Factory-Net-5G", wifi_signal_dbm: -48, network_speed_mbps: 1000,
    status: "online", last_seen_at: new Date().toISOString(),
    last_location_lat: 40.7128, last_location_lng: -74.006,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  "2": {
    id: "2", agent_id: "agent-e5f6g7h8", hostname: "WAREHOUSE-T1",
    os: "Lubuntu", os_version: "22.04 LTS", agent_version: "2.0.0",
    mac_addresses: ["00:2B:3C:4D:5E:6F"], ip_addresses: ["10.0.0.55"],
    cpu_model: "Intel Celeron N5100", cpu_cores: 4,
    ram_total_bytes: 4294967296, storage_total_bytes: 128849018880,
    disk_model: "WD Blue SA510", disk_type: "SSD",
    disk_health_status: "warning", disk_temperature_c: 55,
    wifi_ssid: "Warehouse-WiFi", wifi_signal_dbm: -72, network_speed_mbps: 100,
    status: "warning", last_seen_at: new Date(Date.now() - 120000).toISOString(),
    last_location_lat: 34.0522, last_location_lng: -118.2437,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  "3": {
    id: "3", agent_id: "agent-i9j0k1l2", hostname: "REMOTE-KIOSK-03",
    os: "Windows 10", os_version: "10.0.19045", agent_version: "2.0.0",
    mac_addresses: ["00:3C:4D:5E:6F:7G"], ip_addresses: ["172.16.0.10"],
    cpu_model: "AMD Ryzen 5 5600G", cpu_cores: 6,
    ram_total_bytes: 8589934592, storage_total_bytes: 256060514304,
    disk_model: "Seagate Barracuda 256GB", disk_type: "HDD",
    disk_health_status: "ok", disk_temperature_c: 37,
    wifi_ssid: "", wifi_signal_dbm: null, network_speed_mbps: 0,
    status: "offline", last_seen_at: new Date(Date.now() - 86400000).toISOString(),
    last_location_lat: 51.5074, last_location_lng: -0.1278,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  "4": {
    id: "4", agent_id: "agent-m3n4o5p6", hostname: "SHIPPING-T2",
    os: "Lubuntu", os_version: "22.04 LTS", agent_version: "2.0.0",
    mac_addresses: ["00:4D:5E:6F:7G:8H"], ip_addresses: ["10.0.0.88"],
    cpu_model: "Intel Atom x5-Z8350", cpu_cores: 4,
    ram_total_bytes: 2147483648, storage_total_bytes: 64424509440,
    disk_model: "Kingston A400", disk_type: "SSD",
    disk_health_status: "ok", disk_temperature_c: 39,
    wifi_ssid: "Shipping-WiFi", wifi_signal_dbm: -55, network_speed_mbps: 100,
    status: "online", last_seen_at: new Date().toISOString(),
    last_location_lat: 48.8566, last_location_lng: 2.3522,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
};

function generateMockMetrics(diskHealth?: string, diskTemp?: number | null): MetricsDataPoint[] {
  const points: MetricsDataPoint[] = [];
  const now = Date.now();
  for (let i = 60; i >= 0; i--) {
    const t = new Date(now - i * 60000).toISOString();
    points.push({
      time: t,
      cpu_percent: 20 + Math.random() * 50 + Math.sin(i * 0.3) * 15,
      ram_percent: 40 + Math.random() * 30 + Math.cos(i * 0.2) * 10,
      storage_percent: 55 + (i / 60) * 0.5,
      network_status: "up",
      network_latency_ms: 15 + Math.random() * 35,
      disk_health_status: diskHealth || "ok",
      disk_temperature_c: diskTemp ?? (35 + Math.random() * 5),
    });
  }
  return points;
}

function generateMockLocations(): LocationDataPoint[] {
  const points: LocationDataPoint[] = [];
  const now = Date.now();
  const baseLat = 40.7128;
  const baseLng = -74.006;
  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * 3600000).toISOString();
    points.push({
      time: t,
      latitude: baseLat + (Math.random() - 0.5) * 0.01,
      longitude: baseLng + (Math.random() - 0.5) * 0.01,
      source: i % 5 === 0 ? "geoip" : "os",
    });
  }
  return points;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function wifiSignalLabel(dbm: number | null): { text: string; color: string } {
  if (dbm === null || dbm === 0) return { text: "N/A", color: "text-muted-foreground" };
  if (dbm >= -50) return { text: "Excellent", color: "text-emerald-400" };
  if (dbm >= -65) return { text: "Good", color: "text-blue-400" };
  if (dbm >= -75) return { text: "Fair", color: "text-amber-400" };
  return { text: "Weak", color: "text-red-400" };
}

const AssetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("-1h");

  const asset = id ? mockAssets[id] : null;
  const metrics = useMemo(
    () => generateMockMetrics(asset?.disk_health_status, asset?.disk_temperature_c),
    [asset?.disk_health_status, asset?.disk_temperature_c],
  );
  const locations = useMemo(() => generateMockLocations(), []);

  if (!asset) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <Monitor className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-medium text-muted-foreground">Asset not found</p>
        <button
          onClick={() => navigate("/assets")}
          className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          ← Back to Assets
        </button>
      </div>
    );
  }

  const timeRangeOptions = [
    { label: "1h", value: "-1h" },
    { label: "6h", value: "-6h" },
    { label: "24h", value: "-24h" },
    { label: "7d", value: "-7d" },
  ];

  const signalInfo = wifiSignalLabel(asset.wifi_signal_dbm);

  return (
    <div className="animate-fade-in space-y-5 p-4 md:p-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/assets")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{asset.hostname}</h1>
            <AgentStatusBadge status={asset.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {asset.os} {asset.os_version} • Agent v{asset.agent_version} •{" "}
            <code className="text-xs bg-white/[0.04] px-1.5 py-0.5 rounded">
              {asset.agent_id}
            </code>
          </p>
        </div>
      </div>

      {/* Hardware specs — 2 rows */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Cpu className="h-4 w-4" />
            <span className="text-xs">CPU</span>
          </div>
          <p className="text-sm font-semibold">{asset.cpu_model}</p>
          <p className="text-xs text-muted-foreground">{asset.cpu_cores} cores</p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <HardDrive className="h-4 w-4" />
            <span className="text-xs">RAM</span>
          </div>
          <p className="text-sm font-semibold">{formatBytes(asset.ram_total_bytes)}</p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Disc className="h-4 w-4" />
            <span className="text-xs">Storage</span>
          </div>
          <p className="text-sm font-semibold">{formatBytes(asset.storage_total_bytes)}</p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Laptop className="h-4 w-4" />
            <span className="text-xs">MAC / IP</span>
          </div>
          <p className="text-xs font-mono font-semibold truncate">
            {asset.mac_addresses[0] || "N/A"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {asset.ip_addresses[0] || "N/A"}
          </p>
        </Card>
      </div>

      {/* Disk & Network details */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Disc className="h-4 w-4" />
            <span className="text-xs">Disk Model</span>
          </div>
          <p className="text-sm font-semibold truncate">{asset.disk_model || "Unknown"}</p>
          <p className="text-xs text-muted-foreground">
            {asset.disk_type} • Health:{" "}
            <span
              className={
                asset.disk_health_status === "ok"
                  ? "text-emerald-400"
                  : asset.disk_health_status === "warning"
                    ? "text-amber-400"
                    : asset.disk_health_status === "critical"
                      ? "text-red-400"
                      : "text-muted-foreground"
              }
            >
              {asset.disk_health_status}
            </span>
          </p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Thermometer className="h-4 w-4" />
            <span className="text-xs">Disk Temp</span>
          </div>
          <p className="text-sm font-semibold">
            {asset.disk_temperature_c != null ? `${asset.disk_temperature_c}°C` : "N/A"}
          </p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Wifi className="h-4 w-4" />
            <span className="text-xs">WiFi</span>
          </div>
          <p className="text-sm font-semibold truncate">{asset.wifi_ssid || "N/A"}</p>
          <p className={`text-xs ${signalInfo.color}`}>
            {asset.wifi_signal_dbm != null
              ? `${asset.wifi_signal_dbm} dBm (${signalInfo.text})`
              : "No WiFi"}
          </p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <EthernetPort className="h-4 w-4" />
            <span className="text-xs">Link Speed</span>
          </div>
          <p className="text-sm font-semibold">
            {asset.network_speed_mbps > 0
              ? `${asset.network_speed_mbps} Mbps`
              : "N/A"}
          </p>
        </Card>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-1.5">
        {timeRangeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTimeRange(opt.value)}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              timeRange === opt.value
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "border border-white/[0.06] text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">CPU Usage</h3>
          <MetricsChart data={metrics} metric="cpu_percent" color="#60a5fa" height={200} />
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">RAM Usage</h3>
          <MetricsChart data={metrics} metric="ram_percent" color="#a78bfa" height={200} />
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">Storage Usage</h3>
          <MetricsChart data={metrics} metric="storage_percent" color="#fbbf24" height={200} />
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">Network Latency</h3>
          <MetricsChart data={metrics} metric="network_latency_ms" color="#34d399" height={200} />
        </Card>
      </div>

      {/* Location history map */}
      <Card className="overflow-hidden border-white/[0.06] bg-white/[0.02] p-0">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <h3 className="text-sm font-semibold">Location History</h3>
        </div>
        <MapView
          assets={[asset]}
          center={
            asset.last_location_lat && asset.last_location_lng
              ? [asset.last_location_lat, asset.last_location_lng]
              : [40, -40]
          }
          zoom={12}
          className="h-[320px] rounded-none border-0"
        />
      </Card>
    </div>
  );
};

export default AssetDetailPage;
