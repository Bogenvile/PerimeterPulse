import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { MapView } from "@/components/dashboard/MapView";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import type { Asset } from "@/lib/types";

const mockAssets: Asset[] = [
  {
    id: "1", agent_id: "agent-a1b2c3d4", hostname: "FACTORY-EDGE-01",
    os: "Windows 11", os_version: "10.0.22631", agent_version: "1.0.0",
    mac_addresses: ["00:1A:2B:3C:4D:5E"], cpu_model: "Intel Core i7-13700",
    ram_total_bytes: 17179869184, storage_total_bytes: 512110190592,
    status: "online", last_seen_at: new Date().toISOString(),
    last_location_lat: 40.7128, last_location_lng: -74.006,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: "2", agent_id: "agent-e5f6g7h8", hostname: "WAREHOUSE-T1",
    os: "Lubuntu", os_version: "22.04 LTS", agent_version: "1.0.0",
    mac_addresses: ["00:2B:3C:4D:5E:6F"], cpu_model: "Intel Celeron N5100",
    ram_total_bytes: 4294967296, storage_total_bytes: 128849018880,
    status: "warning", last_seen_at: new Date(Date.now() - 120000).toISOString(),
    last_location_lat: 34.0522, last_location_lng: -118.2437,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: "3", agent_id: "agent-i9j0k1l2", hostname: "REMOTE-KIOSK-03",
    os: "Windows 10", os_version: "10.0.19045", agent_version: "1.0.0",
    mac_addresses: ["00:3C:4D:5E:6F:7G"], cpu_model: "AMD Ryzen 5 5600G",
    ram_total_bytes: 8589934592, storage_total_bytes: 256060514304,
    status: "offline", last_seen_at: new Date(Date.now() - 86400000).toISOString(),
    last_location_lat: 51.5074, last_location_lng: -0.1278,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: "4", agent_id: "agent-m3n4o5p6", hostname: "SHIPPING-T2",
    os: "Lubuntu", os_version: "22.04 LTS", agent_version: "1.0.0",
    mac_addresses: ["00:4D:5E:6F:7G:8H"], cpu_model: "Intel Atom x5-Z8350",
    ram_total_bytes: 2147483648, storage_total_bytes: 64424509440,
    status: "online", last_seen_at: new Date().toISOString(),
    last_location_lat: 48.8566, last_location_lng: 2.3522,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
];

const MapPage = () => {
  const navigate = useNavigate();
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const assetsWithLocation = useMemo(
    () =>
      mockAssets.filter(
        (a) => a.last_location_lat != null && a.last_location_lng != null,
      ),
    [],
  );

  return (
    <div className="animate-fade-in flex h-full flex-col">
      {/* Map fills most of the screen */}
      <div className="relative flex-1">
        <MapView
          assets={assetsWithLocation}
          onAssetClick={setSelectedAsset}
          className="h-full rounded-none border-0"
        />

        {/* Asset info panel */}
        {selectedAsset && (
          <div className="absolute bottom-4 left-4 right-4 z-[1000] md:left-auto md:right-4 md:w-80">
            <Card className="border-white/[0.08] bg-[hsl(222_47%_8%)]/95 p-4 backdrop-blur-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{selectedAsset.hostname}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedAsset.os} • {selectedAsset.cpu_model}
                  </p>
                </div>
                <AgentStatusBadge status={selectedAsset.status} size="md" />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => navigate(`/assets/${selectedAsset.id}`)}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;
