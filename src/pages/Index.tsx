import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { MapView } from "@/components/dashboard/MapView";
import { Cpu, HardDrive, Clock } from "lucide-react";
import type { Asset, DashboardStats } from "@/lib/types";

// Mock data for demonstration — in production this comes from the API
const mockAssets: Asset[] = [
  {
    id: "1",
    agent_id: "agent-a1b2c3d4",
    hostname: "FACTORY-EDGE-01",
    os: "Windows 11",
    os_version: "10.0.22631",
    agent_version: "1.0.0",
    mac_addresses: ["00:1A:2B:3C:4D:5E"],
    cpu_model: "Intel Core i7-13700",
    ram_total_bytes: 17179869184,
    storage_total_bytes: 512110190592,
    status: "online",
    last_seen_at: new Date().toISOString(),
    last_location_lat: 40.7128,
    last_location_lng: -74.006,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    agent_id: "agent-e5f6g7h8",
    hostname: "WAREHOUSE-T1",
    os: "Lubuntu",
    os_version: "22.04 LTS",
    agent_version: "1.0.0",
    mac_addresses: ["00:2B:3C:4D:5E:6F"],
    cpu_model: "Intel Celeron N5100",
    ram_total_bytes: 4294967296,
    storage_total_bytes: 128849018880,
    status: "warning",
    last_seen_at: new Date(Date.now() - 120000).toISOString(),
    last_location_lat: 34.0522,
    last_location_lng: -118.2437,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    agent_id: "agent-i9j0k1l2",
    hostname: "REMOTE-KIOSK-03",
    os: "Windows 10",
    os_version: "10.0.19045",
    agent_version: "1.0.0",
    mac_addresses: ["00:3C:4D:5E:6F:7G"],
    cpu_model: "AMD Ryzen 5 5600G",
    ram_total_bytes: 8589934592,
    storage_total_bytes: 256060514304,
    status: "offline",
    last_seen_at: new Date(Date.now() - 86400000).toISOString(),
    last_location_lat: 51.5074,
    last_location_lng: -0.1278,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "4",
    agent_id: "agent-m3n4o5p6",
    hostname: "SHIPPING-T2",
    os: "Lubuntu",
    os_version: "22.04 LTS",
    agent_version: "1.0.0",
    mac_addresses: ["00:4D:5E:6F:7G:8H"],
    cpu_model: "Intel Atom x5-Z8350",
    ram_total_bytes: 2147483648,
    storage_total_bytes: 64424509440,
    status: "online",
    last_seen_at: new Date().toISOString(),
    last_location_lat: 48.8566,
    last_location_lng: 2.3522,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const Index = () => {
  const navigate = useNavigate();

  const stats: DashboardStats = useMemo(() => {
    const online = mockAssets.filter((a) => a.status === "online");
    return {
      total_assets: mockAssets.length,
      online_count: mockAssets.filter((a) => a.status === "online").length,
      offline_count: mockAssets.filter((a) => a.status === "offline").length,
      warning_count: mockAssets.filter((a) => a.status === "warning").length,
      critical_count: mockAssets.filter((a) => a.status === "critical").length,
      avg_cpu_percent: 42.3,
      avg_ram_percent: 58.7,
    };
  }, []);

  return (
    <div className="animate-fade-in space-y-6 p-4 md:p-6">
      {/* Stats row */}
      <StatsCards stats={stats} />

      {/* Map + Recent Assets */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <Card className="lg:col-span-2 overflow-hidden border-white/[0.06] bg-white/[0.02] p-0">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h3 className="text-sm font-semibold">Asset Locations</h3>
            <button
              onClick={() => navigate("/map")}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Full map →
            </button>
          </div>
          <MapView
            assets={mockAssets}
            onAssetClick={(a) => navigate(`/assets/${a.id}`)}
            className="h-[360px] rounded-none border-0"
          />
        </Card>

        {/* Recent assets list */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h3 className="text-sm font-semibold">All Assets</h3>
            <button
              onClick={() => navigate("/assets")}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {mockAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => navigate(`/assets/${asset.id}`)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">
                    {asset.hostname}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {asset.os} • {asset.cpu_model}
                  </p>
                </div>
                <AgentStatusBadge
                  status={asset.status}
                  showLabel={false}
                  size="md"
                />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick metrics panel */}
      <Card className="border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="mb-4 text-sm font-semibold">System Overview</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Cpu className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Agents Reporting</p>
              <p className="text-lg font-bold">4/4</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
              <HardDrive className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Storage</p>
              <p className="text-lg font-bold">954 GB</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Clock className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Uptime</p>
              <p className="text-lg font-bold">14d 6h</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Index;
