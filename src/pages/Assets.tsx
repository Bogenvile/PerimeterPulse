import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DeleteAssetDialog } from "@/components/dashboard/DeleteAssetDialog";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton-card";
import { Search, SlidersHorizontal, Loader2, AlertCircle, Monitor, Wifi, Disc, Cpu, MapPin, ChevronRight, Trash2, LayoutGrid, List, Tag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, deleteAsset, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { showSuccess, showError } from "@/utils/toast";
import type { ExtendedAsset, AgentStatus } from "@/lib/types";

const statusFilterOptions: { label: string; value: AgentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Online", value: "online" },
  { label: "Warning", value: "warning" },
  { label: "Critical", value: "critical" },
  { label: "Offline", value: "offline" },
];

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

function getDiskWarning(status: string, healthPercent?: number | null): string {
  if (healthPercent != null) return ` · ${Math.round(healthPercent)}%`;
  if (status === "warning" || status === "critical") return " ⚠";
  return "";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

type ViewMode = "grid" | "table";

const AssetsPage = () => {
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ExtendedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

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

  // Collect all unique tags for suggestions
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const a of assets) {
      for (const t of a.tags || []) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const effectiveStatus = computeEffectiveStatus(a);
      if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
      if (tagFilter) {
        const filterTags = tagFilter.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (filterTags.length > 0) {
          const assetTags = (a.tags || []).map((t) => t.toLowerCase());
          if (!filterTags.some((ft) => assetTags.includes(ft))) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          a.hostname.toLowerCase().includes(q) ||
          a.os.toLowerCase().includes(q) ||
          a.cpu_model.toLowerCase().includes(q) ||
          a.agent_id.toLowerCase().includes(q) ||
          (a.wifi_ssid || "").toLowerCase().includes(q) ||
          (a.disk_model || "").toLowerCase().includes(q) ||
          (a.tags || []).some((t) => t.includes(q))
        );
      }
      return true;
    }).map(a => ({ ...a, _effectiveStatus: computeEffectiveStatus(a) }));
  }, [search, statusFilter, tagFilter, assets]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium text-destructive">{error}</p>
      </div>
    );
  }

  if (assets.length === 0 && !loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Monitor className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">No Assets Registered</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Deploy the agent on your PCs and they will register automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and monitor all registered devices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="w-full sm:w-64 rounded-lg border border-input bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-9 w-9 items-center justify-center transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex h-9 w-9 items-center justify-center transition-colors border-l border-border ${viewMode === "table" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {statusFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === opt.value
                ? "bg-foreground text-background"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="relative flex items-center gap-1.5 ml-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Filter tags: production,office..."
            className="w-40 rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          {tagFilter && (
            <button onClick={() => setTagFilter("")} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {assets.length}
        </span>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((asset) => (
              <div
                key={asset.id}
                className="group rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-border/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{asset.hostname}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{asset.os} {asset.os_version}</p>
                  </div>
                  <AgentStatusBadge status={asset._effectiveStatus!} size="sm" />
                </div>

                {asset.tags && asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {asset.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-2.5 text-xs">
                  <InfoRow icon={<Cpu className="h-3.5 w-3.5" />} label="CPU" value={asset.cpu_model.split(" ").slice(-1)[0]} />
                  <InfoRow icon={<Wifi className="h-3.5 w-3.5" />} label="WiFi" value={asset.wifi_ssid || "N/A"} />
                  <InfoRow icon={<Disc className="h-3.5 w-3.5" />} label="Disk" value={`${asset.disk_type || "?"}${getDiskWarning(asset.disk_health_status, asset.disk_health_percent)}`} />
                  <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="IP" value={asset.ip_addresses?.[0] || "N/A"} />
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {formatLastSeen(asset.last_seen_at)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      View
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    {isAdmin && (
                      <DeleteAssetDialog
                        hostname={asset.hostname}
                        onConfirm={() => handleDelete(asset)}
                        trigger={
                          <button
                            disabled={deletingId === asset.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Table View */}
      {viewMode === "table" && (
        loading ? (
          <SkeletonTable rows={6} />
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Host</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">OS</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">CPU</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Seen</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((asset) => (
                    <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground">
                            {asset.hostname.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[180px]">{asset.hostname}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">{asset.ip_addresses?.[0] || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">
                        <span className="text-xs">{asset.os} {asset.os_version}</span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden xl:table-cell">
                        <span className="text-xs truncate block max-w-[120px]" title={asset.cpu_model}>{asset.cpu_model.split(" ").slice(-2).join(" ")}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {asset.tags && asset.tags.length > 0
                            ? asset.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                  {tag}
                                </span>
                              ))
                            : <span className="text-xs text-muted-foreground/40">—</span>
                          }
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <AgentStatusBadge status={asset._effectiveStatus!} size="sm" />
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        <span className="text-xs">{formatLastSeen(asset.last_seen_at)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/assets/${asset.id}`)}
                            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                          >
                            View
                            <ChevronRight className="h-3 w-3" />
                          </button>
                          {isAdmin && (
                            <DeleteAssetDialog
                              hostname={asset.hostname}
                              onConfirm={() => handleDelete(asset)}
                              trigger={
                                <button
                                  disabled={deletingId === asset.id}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <SlidersHorizontal className="mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">No assets match your filters</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium text-foreground truncate max-w-[100px]">{value}</span>
    </div>
  );
}

export default AssetsPage;