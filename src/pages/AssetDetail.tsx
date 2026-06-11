import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { MapView } from "@/components/dashboard/MapView";
import { DeleteAssetDialog } from "@/components/dashboard/DeleteAssetDialog";
import { RemoteCommands } from "@/components/dashboard/RemoteCommands";
import {
  ArrowLeft, Cpu, HardDrive, Wifi, Laptop, Disc, Thermometer, Network,
  Loader2, AlertCircle, Monitor, MapPin, Globe, Bug, X, Trash2, Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAsset, getAssetMetrics, getAssetLocations, fetchErrorLogs, deleteAsset, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import { showSuccess, showError } from "@/utils/toast";
import type { ExtendedAsset, MetricsDataPoint, LocationDataPoint, ErrorLogItem } from "@/lib/types";

function fmt(n: unknown): number {
  const v = Number(n);
  return isNaN(v) ? 0 : v;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function wifiSignalLabel(dbm: number | null): { text: string; color: string } {
  if (dbm === null || dbm === 0 || dbm === -999) return { text: "No data", color: "text-muted-foreground" };
  if (dbm >= -50) return { text: "Excellent", color: "text-emerald-600" };
  if (dbm >= -65) return { text: "Good", color: "text-primary" };
  if (dbm >= -75) return { text: "Fair", color: "text-amber-600" };
  return { text: "Weak", color: "text-destructive" };
}

function getHealthColor(status?: string): string {
  switch (status) {
    case "ok": return "text-emerald-600";
    case "warning": return "text-amber-600";
    case "critical": return "text-destructive";
    default: return "text-muted-foreground";
  }
}

function getPingColor(ms: number | null): string {
  if (ms == null || ms <= 0) return "text-muted-foreground";
  if (ms < 30) return "text-emerald-600";
  if (ms < 100) return "text-primary";
  if (ms < 200) return "text-amber-600";
  return "text-destructive";
}

function getPingLabel(ms: number | null): string {
  if (ms == null || ms <= 0) return "N/A";
  if (ms < 30) return "Excellent";
  if (ms < 100) return "Good";
  if (ms < 200) return "Fair";
  return "High latency";
}

const timeRangeOptions = [
  { label: "1h", value: "-1h" },
  { label: "6h", value: "-6h" },
  { label: "24h", value: "-24h" },
  { label: "7d", value: "-7d" },
];

type DetailTab = "overview" | "charts" | "commands";

const AssetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<ExtendedAsset | null>(null);
  const [metrics, setMetrics] = useState<MetricsDataPoint[]>([]);
  const [locations, setLocations] = useState<LocationDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState("-1h");
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    setApiToken(token);
    setLoading(true);
    setError("");
    Promise.all([
      getAsset(id).catch((e) => { throw new Error("Asset: " + e.message); }),
      getAssetMetrics(id, timeRange).catch(() => [] as MetricsDataPoint[]),
      getAssetLocations(id, "-24h").catch(() => [] as LocationDataPoint[]),
    ])
      .then(([a, m, l]) => { setAsset(a); setMetrics(m); setLocations(l); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id, timeRange]);

  useEffect(() => {
    if (!showErrorDetail || !id || !token) return;
    setLoadingErrors(true);
    setApiToken(token);
    fetchErrorLogs(id, 50)
      .then(setErrorLogs)
      .catch(() => setErrorLogs([]))
      .finally(() => setLoadingErrors(false));
  }, [showErrorDetail, id, token]);

  const handleDelete = useCallback(async () => {
    if (!asset) return;
    setDeleting(true);
    try {
      await deleteAsset(asset.id);
      showSuccess(`${asset.hostname} deleted`);
      navigate("/assets", { replace: true });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }, [asset, navigate]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <button onClick={() => navigate("/assets")} className="text-sm text-primary hover:underline">← Back to Assets</button>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <Monitor className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-bold text-foreground">Asset not found</p>
        <button onClick={() => navigate("/assets")} className="mt-3 text-sm text-primary hover:underline">← Back to Assets</button>
      </div>
    );
  }

  const effectiveStatus = computeEffectiveStatus(asset);
  const signalInfo = wifiSignalLabel(asset.wifi_signal_dbm);
  const hasSignal = asset.wifi_signal_dbm != null && asset.wifi_signal_dbm !== 0 && asset.wifi_signal_dbm !== -999;
  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const mapAsset = { ...asset, status: effectiveStatus };

  const tabs: { key: DetailTab; label: string; adminOnly?: boolean }[] = [
    { key: "overview", label: "Overview" },
    { key: "charts", label: "Charts" },
    { key: "commands", label: "Commands", adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="animate-fade-in space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate("/assets")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors mt-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{asset.hostname}</h1>
            <AgentStatusBadge status={effectiveStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {asset.os} {asset.os_version} · Agent v{asset.agent_version}
          </p>
          {asset.city && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Globe className="h-3 w-3" /> {asset.city}{asset.country ? `, ${asset.country}` : ""}
            </p>
          )}
        </div>
        {isAdmin && (
          <DeleteAssetDialog
            hostname={asset.hostname}
            onConfirm={handleDelete}
            trigger={
              <button
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            }
          />
        )}
      </div>

      {/* Hardware Info Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={<Cpu className="h-4 w-4" />} label="CPU" value={asset.cpu_model} sub={`${asset.cpu_cores} cores`} />
        <InfoCard icon={<HardDrive className="h-4 w-4" />} label="RAM" value={formatBytes(asset.ram_total_bytes)} sub={latest ? `${fmt(latest.ram_percent).toFixed(1)}% used` : undefined} />
        <InfoCard icon={<Disc className="h-4 w-4" />} label="Storage" value={formatBytes(asset.storage_total_bytes)} sub={latest ? `${fmt(latest.storage_percent).toFixed(1)}% used` : undefined} />
        <InfoCard icon={<Laptop className="h-4 w-4" />} label="MAC / IP" value={asset.mac_addresses?.[0] || "N/A"} sub={asset.ip_addresses?.[0] || "N/A"} mono />
      </div>

      {/* Network & Disk Info Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <InfoCard icon={<Disc className="h-4 w-4" />} label="Disk" value={asset.disk_model || "Unknown"} sub={`${asset.disk_type || "unknown"} · ${getHealthColor(asset.disk_health_status).includes("emerald") ? "OK" : asset.disk_health_status || "unknown"}`} />
        <InfoCard icon={<Thermometer className="h-4 w-4" />} label="Temperature" value={asset.disk_temperature_c != null ? `${asset.disk_temperature_c}°C` : "N/A"} />
        <InfoCard icon={<Wifi className="h-4 w-4" />} label="WiFi" value={asset.wifi_ssid || "N/A"} sub={hasSignal ? `${asset.wifi_signal_dbm} dBm · ${signalInfo.text}` : signalInfo.text} />
        <InfoCard icon={<Network className="h-4 w-4" />} label="Network" value={asset.network_speed_mbps > 0 ? `${asset.network_speed_mbps} Mbps` : "N/A"} sub={asset.gateway_ip ? `GW: ${asset.gateway_ip}` : undefined} />
        <InfoCard
          icon={<Zap className="h-4 w-4" />}
          label="Ping (8.8.8.8)"
          value={asset.ping_latency_ms != null && asset.ping_latency_ms > 0 ? `${fmt(asset.ping_latency_ms).toFixed(1)} ms` : "N/A"}
          valueColor={getPingColor(asset.ping_latency_ms)}
          sub={getPingLabel(asset.ping_latency_ms)}
        />
      </div>

      {/* Error Logs Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${asset.error_count > 0 ? "bg-destructive/10" : "bg-emerald-50"}`}>
              <Bug className={`h-4 w-4 ${asset.error_count > 0 ? "text-destructive" : "text-emerald-600"}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Error Logs</h3>
              <p className="text-xs text-muted-foreground">
                {asset.error_count > 0
                  ? `${asset.error_count} error${asset.error_count > 1 ? "s" : ""} recorded`
                  : "No errors recorded"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowErrorDetail(true)}
            className="rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            View Logs
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          {/* Location */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Location</h3>
              </div>
              {asset.city && <span className="text-xs text-muted-foreground">{asset.city}{asset.country ? `, ${asset.country}` : ""}</span>}
            </div>
            {asset.last_location_lat != null && asset.last_location_lng != null ? (
              <MapView assets={[mapAsset]} center={[asset.last_location_lat, asset.last_location_lng]} zoom={13} className="h-[320px] rounded-none border-0" />
            ) : (
              <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">No location data available</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "charts" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-1.5">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === opt.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="CPU Usage">
              {metrics.length > 0 ? <MetricsChart data={metrics} metric="cpu_percent" height={200} /> : <EmptyChart />}
            </ChartCard>
            <ChartCard title="RAM Usage">
              {metrics.length > 0 ? <MetricsChart data={metrics} metric="ram_percent" height={200} /> : <EmptyChart />}
            </ChartCard>
            <ChartCard title="Storage Usage">
              {metrics.length > 0 ? <MetricsChart data={metrics} metric="storage_percent" height={200} /> : <EmptyChart />}
            </ChartCard>
            <ChartCard title="Ping Latency (8.8.8.8)">
              {metrics.length > 0 ? <MetricsChart data={metrics} metric="ping_latency_ms" height={200} /> : <EmptyChart />}
            </ChartCard>
          </div>
        </div>
      )}

      {activeTab === "commands" && (
        <div className="animate-fade-in">
          <RemoteCommands assetId={asset.id} token={token} />
        </div>
      )}

      {/* Error Detail Modal */}
      {showErrorDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold text-foreground">Error Logs (last 50)</h3>
              </div>
              <button onClick={() => setShowErrorDetail(false)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto space-y-2">
              {loadingErrors ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : errorLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No error logs recorded</p>
              ) : (
                errorLogs.map((log, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">{new Date(log.time).toLocaleString()}</span>
                      <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">{log.level}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Source: {log.source || "N/A"}</p>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">{log.message || "No message"}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function InfoCard({ icon, label, value, sub, mono, valueColor }: { icon: React.ReactNode; label: string; value: string; sub?: string; mono?: boolean; valueColor?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-sm font-semibold truncate ${mono ? "font-mono" : ""} ${valueColor || ""}`} title={value}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <p className="text-xs text-muted-foreground py-8 text-center">Waiting for agent heartbeat...</p>;
}

export default AssetDetailPage;