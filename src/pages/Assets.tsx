import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { Search, SlidersHorizontal, Loader2, AlertCircle, Monitor } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, setApiToken } from "@/lib/api";
import type { ExtendedAsset, AgentStatus } from "@/lib/types";

const statusFilterOptions: { label: string; value: AgentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Online", value: "online" },
  { label: "Warning", value: "warning" },
  { label: "Critical", value: "critical" },
  { label: "Offline", value: "offline" },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AssetsPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ExtendedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");

  useEffect(() => {
    if (!token) return;
    setApiToken(token);
    getAssets()
      .then(setAssets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.hostname.toLowerCase().includes(q) ||
          a.os.toLowerCase().includes(q) ||
          a.cpu_model.toLowerCase().includes(q) ||
          a.agent_id.toLowerCase().includes(q) ||
          (a.wifi_ssid || "").toLowerCase().includes(q) ||
          (a.disk_model || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, statusFilter, assets]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <Monitor className="h-16 w-16 text-muted-foreground opacity-20" />
        <p className="text-lg font-medium text-muted-foreground">No assets registered yet</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          Deploy the agent on your PCs and they will register automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Assets</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {assets.length} assets
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostname, OS, WiFi, disk..."
            className="w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {statusFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "border border-white/[0.06] text-muted-foreground hover:text-foreground hover:border-white/[0.12]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((asset) => (
          <Card
            key={asset.id}
            onClick={() => navigate(`/assets/${asset.id}`)}
            className="cursor-pointer border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04] hover:border-white/[0.1]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{asset.hostname}</p>
                <p className="text-xs text-muted-foreground">{asset.os} {asset.os_version}</p>
              </div>
              <AgentStatusBadge status={asset.status} showLabel={false} />
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>CPU</span>
                <span className="text-foreground">{asset.cpu_model.split(" ").slice(-1)[0]}</span>
              </div>
              <div className="flex justify-between">
                <span>RAM</span>
                <span className="text-foreground">{formatBytes(asset.ram_total_bytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>Disk</span>
                <span className="text-foreground">
                  {asset.disk_type}{" "}
                  {asset.disk_health_status !== "ok" && `⚠ ${asset.disk_health_status}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>WiFi</span>
                <span className="text-foreground truncate ml-2 max-w-[100px]" title={asset.wifi_ssid}>
                  {asset.wifi_ssid || "N/A"}
                  {asset.wifi_signal_dbm != null && ` (${asset.wifi_signal_dbm} dBm)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>IP</span>
                <span className="text-foreground font-mono text-[10px]">
                  {asset.ip_addresses?.[0] || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last seen</span>
                <span className="text-foreground">{formatLastSeen(asset.last_seen_at)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <SlidersHorizontal className="mb-3 h-8 w-8 opacity-40" />
          <p className="text-sm">No assets match your filters</p>
        </div>
      )}
    </div>
  );
};

export default AssetsPage;
