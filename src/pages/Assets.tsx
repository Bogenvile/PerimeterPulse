import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { DeleteAssetDialog } from "@/components/dashboard/DeleteAssetDialog";
import { Search, SlidersHorizontal, Loader2, AlertCircle, Monitor, Wifi, Disc, Cpu, MapPin, ChevronRight, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, deleteAsset, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import { showSuccess, showError } from "@/utils/toast";
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
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ExtendedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setApiToken(token);
    getAssets()
      .then(setAssets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDelete = useCallback(async (asset: ExtendedAsset) => {
    setDeletingId(asset.id);
    try {
      await deleteAsset(asset.id);
      showSuccess(`${asset.hostname} deleted`);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const effectiveStatus = computeEffectiveStatus(a);
      if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
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
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <p className="text-base font-semibold text-red-600">Connection Failed</p>
        <p className="text-sm text-gray-500 max-w-xs text-center">{error}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50">
          <Monitor className="h-10 w-10 text-blue-500" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">No Assets Registered</p>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Deploy the agent on your PCs and they will register automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Assets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and monitor all registered devices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="w-full sm:w-64 rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              statusFilter === opt.value
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto flex items-center text-xs text-gray-400">
          {filtered.length} of {assets.length} assets
        </span>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((asset) => {
          const effectiveStatus = computeEffectiveStatus(asset);
          return (
            <div
              key={asset.id}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{asset.hostname}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{asset.os} {asset.os_version}</p>
                </div>
                <StatusIndicator status={effectiveStatus} />
              </div>

              <div className="space-y-3 text-xs">
                <DetailRow icon={<Cpu className="h-3.5 w-3.5 text-gray-400" />} label="CPU" value={asset.cpu_model.split(" ").slice(-1)[0]} />
                <DetailRow icon={<Wifi className="h-3.5 w-3.5 text-gray-400" />} label="WiFi" value={asset.wifi_ssid || "N/A"} />
                <DetailRow icon={<Disc className="h-3.5 w-3.5 text-gray-400" />} label="Disk" value={`${asset.disk_type} ${asset.disk_health_status !== "ok" ? `⚠` : ""}`} />
                <DetailRow icon={<MapPin className="h-3.5 w-3.5 text-gray-400" />} label="IP" value={asset.ip_addresses?.[0] || "N/A"} />
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-400">
                  Last seen {formatLastSeen(asset.last_seen_at)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    View
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  {isAdmin && (
                    <DeleteAssetDialog
                      hostname={asset.hostname}
                      onConfirm={() => handleDelete(asset)}
                      trigger={
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <SlidersHorizontal className="mb-3 h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">No assets match your filters</p>
        </div>
      )}
    </div>
  );
};

function StatusIndicator({ status }: { status: AgentStatus }) {
  const styles: Record<AgentStatus, string> = {
    online: "bg-emerald-50 text-emerald-600",
    offline: "bg-gray-100 text-gray-500",
    warning: "bg-amber-50 text-amber-600",
    critical: "bg-red-50 text-red-600",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-gray-500">{label}</span>
      </div>
      <span className="font-medium text-gray-900 truncate ml-2 max-w-[100px]">{value}</span>
    </div>
  );
}

export default AssetsPage;