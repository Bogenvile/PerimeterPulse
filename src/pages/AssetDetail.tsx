import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { MapView } from "@/components/dashboard/MapView";
import {
  ArrowLeft, Cpu, HardDrive, Wifi, Laptop, Disc, Thermometer, EthernetPort,
  Loader2, AlertCircle, Monitor,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAsset, getAssetMetrics, getAssetLocations, setApiToken } from "@/lib/api";
import type { ExtendedAsset, MetricsDataPoint, LocationDataPoint } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function wifiSignalLabel(dbm: number | null): { text: string; color: string } {
  if (dbm === null || dbm === 0 || dbm === -999) return { text: "No signal", color: "text-muted-foreground" };
  if (dbm >= -50) return { text: "Excellent", color: "text-emerald-400" };
  if (dbm >= -65) return { text: "Good", color: "text-blue-400" };
  if (dbm >= -75) return { text: "Fair", color: "text-amber-400" };
  return { text: "Weak", color: "text-red-400" };
}

const timeRangeOptions = [
  { label: "1h", value: "-1h" },
  { label: "6h", value: "-6h" },
  { label: "24h", value: "-24h" },
  { label: "7d", value: "-7d" },
];

const AssetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<ExtendedAsset | null>(null);
  const [metrics, setMetrics] = useState<MetricsDataPoint[]>([]);
  const [locations, setLocations] = useState<LocationDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState("-1h");

  useEffect(() => {
    if (!token || !id) return;
    setApiToken(token);
    setLoading(true);
    Promise.all([
      getAsset(id),
      getAssetMetrics(id, timeRange),
      getAssetLocations(id, "-24h"),
    ])
      .then(([a, m, l]) => {
        setAsset(a);
        setMetrics(m);
        setLocations(l);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id, timeRange]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={() => navigate("/assets")} className="text-sm text-blue-400 hover:text-blue-300">
          ← Back to Assets
        </button>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <Monitor className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-medium text-muted-foreground">Asset not found</p>
        <button onClick={() => navigate("/assets")} className="mt-3 text-sm text-blue-400 hover:text-blue-300">
          ← Back to Assets
        </button>
      </div>
    );
  }

  const signalInfo = wifiSignalLabel(asset.wifi_signal_dbm);

  return (
    <div className="animate-fade-in space-y-5 p-4 md:p-6">
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
            <code className="text-xs bg-white/[0.04] px-1.5 py-0.5 rounded">{asset.agent_id}</code>
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Cpu className="h-4 w-4" /><span className="text-xs">CPU</span>
          </div>
          <p className="text-sm font-semibold">{asset.cpu_model}</p>
          <p className="text-xs text-muted-foreground">{asset.cpu_cores} cores</p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <HardDrive className="h-4 w-4" /><span className="text-xs">RAM</span>
          </div>
          <p className="text-sm font-semibold">{formatBytes(asset.ram_total_bytes)}</p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Disc className="h-4 w-4" /><span className="text-xs">Storage</span>
          </div>
          <p className="text-sm font-semibold">{formatBytes(asset.storage_total_bytes)}</p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Laptop className="h-4 w-4" /><span className="text-xs">MAC / IP</span>
          </div>
          <p className="text-xs font-mono font-semibold truncate">{asset.mac_addresses?.[0] || "N/A"}</p>
          <p className="text-xs text-muted-foreground truncate">{asset.ip_addresses?.[0] || "N/A"}</p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Disc className="h-4 w-4" /><span className="text-xs">Disk</span>
          </div>
          <p className="text-sm font-semibold truncate">{asset.disk_model || "Unknown"}</p>
          <p className="text-xs">
            {asset.disk_type || "unknown"} •{" "}
            <span className={
              asset.disk_health_status === "ok" ? "text-emerald-400" :
              asset.disk_health_status === "warning" ? "text-amber-400" :
              asset.disk_health_status === "critical" ? "text-red-400" : "text-muted-foreground"
            }>
              {asset.disk_health_status || "unknown"}
            </span>
          </p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Thermometer className="h-4 w-4" /><span className="text-xs">Temp</span>
          </div>
          <p className="text-sm font-semibold">
            {asset.disk_temperature_c != null ? `${asset.disk_temperature_c}°C` : "N/A"}
          </p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Wifi className="h-4 w-4" /><span className="text-xs">WiFi</span>
          </div>
          <p className="text-sm font-semibold truncate">{asset.wifi_ssid || "N/A"}</p>
          <p className={`text-xs ${signalInfo.color}`}>
            {asset.wifi_signal_dbm != null && asset.wifi_signal_dbm !== -999
              ? `${asset.wifi_signal_dbm} dBm (${signalInfo.text})`
              : signalInfo.text}
          </p>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <EthernetPort className="h-4 w-4" /><span className="text-xs">Link Speed</span>
          </div>
          <p className="text-sm font-semibold">
            {asset.network_speed_mbps > 0 ? `${asset.network_speed_mbps} Mbps` : "N/A"}
          </p>
        </Card>
      </div>

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

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">CPU Usage</h3>
          {metrics.length > 0 ? (
            <MetricsChart data={metrics} metric="cpu_percent" color="#60a5fa" height={200} />
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No metrics data yet</p>
          )}
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">RAM Usage</h3>
          {metrics.length > 0 ? (
            <MetricsChart data={metrics} metric="ram_percent" color="#a78bfa" height={200} />
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No metrics data yet</p>
          )}
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">Storage Usage</h3>
          {metrics.length > 0 ? (
            <MetricsChart data={metrics} metric="storage_percent" color="#fbbf24" height={200} />
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No metrics data yet</p>
          )}
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">Network Latency</h3>
          {metrics.length > 0 ? (
            <MetricsChart data={metrics} metric="network_latency_ms" color="#34d399" height={200} />
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No metrics data yet</p>
          )}
        </Card>
      </div>

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