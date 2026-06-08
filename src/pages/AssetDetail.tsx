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
  Clock,
  Wifi,
  Laptop,
  Monitor,
} from "lucide-react";
import type { Asset, MetricsDataPoint, LocationDataPoint } from "@/lib/types";

// Mock asset registry
const mockAssets: Record<string, Asset> = {
  "1": {
    id: "1", agent_id: "agent-a1b2c3d4", hostname: "FACTORY-EDGE-01",
    os: "Windows 11", os_version: "10.0.22631", agent_version: "1.0.0",
    mac_addresses: ["00:1A:2B:3C:4D:5E"], cpu_model: "Intel Core i7-13700",
    ram_total_bytes: 17179869184, storage_total_bytes: 512110190592,
    status: "online", last_seen_at: new Date().toISOString(),
    last_location_lat: 40.7128, last_location_lng: -74.006,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  "2": {
    id: "2", agent_id: "agent-e5f6g7h8", hostname: "WAREHOUSE-T1",
    os: "Lubuntu", os_version: "22.04 LTS", agent_version: "1.0.0",
    mac_addresses: ["00:2B:3C:4D:5E:6F"], cpu_model: "Intel Celeron N5100",
    ram_total_bytes: 4294967296, storage_total_bytes: 128849018880,
    status: "warning", last_seen_at: new Date(Date.now() - 120000).toISOString(),
    last_location_lat: 34.0522, last_location_lng: -118.2437,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  "3": {
    id: "3", agent_id: "agent-i9j0k1l2", hostname: "REMOTE-KIOSK-03",
    os: "Windows 10", os_version: "10.0.19045", agent_version: "1.0.0",
    mac_addresses: ["00:3C:4D:5E:6F:7G"], cpu_model: "AMD Ryzen 5 5600G",
    ram_total_bytes: 8589934592, storage_total_bytes: 256060514304,
    status: "offline", last_seen_at: new Date(Date.now() - 86400000).toISOString(),
    last_location_lat: 51.5074, last_location_lng: -0.1278,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  "4": {
    id: "4", agent_id: "agent-m3n4o5p6", hostname: "SHIPPING-T2",
    os: "Lubuntu", os_version: "22.04 LTS", agent_version: "1.0.0",
    mac_addresses: ["00:4D:5E:6F:7G:8H"], cpu_model: "Intel Atom x5-Z8350",
    ram_total_bytes: 2147483648, storage_total_bytes: 64424509440,
    status: "online", last_seen_at: new Date().toISOString(),
    last_location_lat: 48.8566, last_location_lng: 2.3522,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
};

function generateMockMetrics(): MetricsDataPoint[] {
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

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const AssetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("-1h");

  const asset = id ? mockAssets[id] : null;
  const metrics = useMemo(() => generateMockMetrics(), []);
  const locations = useMemo(() => generateMockLocations(), []);

  if (!asset) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <Monitor className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-medium text-muted-foreground">
          Asset not found
        </p>
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
            {asset.os} {asset.os_version} • Agent {asset.agent_version} •{" "}
            <code className="text-xs bg-white/[0.04] px-1.5 py-0.5 rounded">
              {asset.agent_id}
            </code>
          </p>
        </div>
      </div>

      {/* Hardware specs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Cpu className="h-4 w-4" />
            <span className="text-xs">CPU</span>
          </div>
          <p className="text-sm font-semibold">{asset.cpu_model}</p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <HardDrive className="h-4 w-4" />
            <span className="text-xs">RAM</span>
          </div>
          <p className="text-sm font-semibold">
            {formatBytes(asset.ram_total_bytes)}
          </p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <HardDrive className="h-4 w-4" />
            <span className="text-xs">Storage</span>
          </div>
          <p className="text-sm font-semibold">
            {formatBytes(asset.storage_total_bytes)}
          </p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Laptop className="h-4 w-4" />
            <span className="text-xs">MAC Address</span>
          </div>
          <p className="text-xs font-mono font-semibold truncate">
            {asset.mac_addresses.join(", ")}
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
          <MetricsChart
            data={metrics}
            metric="cpu_percent"
            color="#60a5fa"
            height={200}
          />
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">RAM Usage</h3>
          <MetricsChart
            data={metrics}
            metric="ram_percent"
            color="#a78bfa"
            height={200}
          />
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">Storage Usage</h3>
          <MetricsChart
            data={metrics}
            metric="storage_percent"
            color="#fbbf24"
            height={200}
          />
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">Network Latency</h3>
          <MetricsChart
            data={metrics}
            metric="network_latency_ms"
            color="#34d399"
            height={200}
          />
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
