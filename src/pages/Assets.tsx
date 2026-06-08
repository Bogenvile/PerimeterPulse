import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { Search, SlidersHorizontal } from "lucide-react";
import type { ExtendedAsset, AgentStatus } from "@/lib/types";

const mockAssets: ExtendedAsset[] = [
  {
    id: "1", agent_id: "agent-a1b2c3d4", hostname: "FACTORY-EDGE-01",
    os: "Windows 11", os_version: "10.0.22631", agent_version: "2.0.0",
    mac_addresses: ["00:1A:2B:3C:4D:5E"], ip_addresses: ["192.168.1.101"],
    cpu_model: "Intel Core i7-13700", cpu_cores: 16,
    ram_total_bytes: 17179869184, storage_total_bytes: 512110190592,
    disk_model: "Samsung 990 Pro", disk_type: "NVMe",
    disk_health_status: "ok", disk_temperature_c: 42,
    wifi_ssid: "Factory-Net-5G", wifi_signal_dbm: -48, network_speed_mbps: 1000,
    status: "online", last_seen_at: new Date().toISOString(),
    last_location_lat: 40.7128, last_location_lng: -74.006,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
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
  {
    id: "3", agent_id: "agent-i9j0k1l2", hostname: "REMOTE-KIOSK-03",
    os: "Windows 10", os_version: "10.0.19045", agent_version: "2.0.0",
    mac_addresses: ["00:3C:4D:5E:6F:7G"], ip_addresses: ["172.16.0.10"],
    cpu_model: "AMD Ryzen 5 5600G", cpu_cores: 6,
    ram_total_bytes: 8589934592, storage_total_bytes: 256060514304,
    disk_model: "Seagate Barracuda", disk_type: "HDD",
    disk_health_status: "ok", disk_temperature_c: 37,
    wifi_ssid: "", wifi_signal_dbm: null, network_speed_mbps: 0,
    status: "offline", last_seen_at: new Date(Date.now() - 86400000).toISOString(),
    last_location_lat: 51.5074, last_location_lng: -0.1278,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
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
];

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
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");

  const filtered = useMemo(() => {
    return mockAssets.filter((a) => {
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
  }, [search, statusFilter]);

  return (
    <div className="animate-fade-in space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Assets</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {mockAssets.length} assets
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by hostname, OS, WiFi, disk..."
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
                <p className="text-xs text-muted-foreground">
                  {asset.os} {asset.os_version}
                </p>
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
                  {asset.disk_type} {asset.disk_health_status !== "ok" && `⚠ ${asset.disk_health_status}`}
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
                  {asset.ip_addresses[0] || "N/A"}
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
