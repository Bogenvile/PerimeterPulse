import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { MapView } from "@/components/dashboard/MapView";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { Loader2, AlertCircle, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, setApiToken } from "@/lib/api";
import type { ExtendedAsset } from "@/lib/types";

const MapPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ExtendedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<ExtendedAsset | null>(null);

  useEffect(() => {
    if (!token) return;
    setApiToken(token);
    getAssets()
      .then(setAssets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const assetsWithLocation = useMemo(
    () => assets.filter((a) => a.last_location_lat != null && a.last_location_lng != null),
    [assets],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (assetsWithLocation.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <MapPin className="h-16 w-16 text-muted-foreground opacity-20" />
        <p className="text-lg font-medium text-muted-foreground">No location data available</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          Agents will appear on the map once they start sending location data.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex h-full flex-col">
      <div className="relative flex-1">
        <MapView
          assets={assetsWithLocation}
          onAssetClick={(a) => {
            const match = assets.find((m) => m.id === a.id);
            if (match) setSelectedAsset(match);
          }}
          className="h-full rounded-none border-0"
        />
        {selectedAsset && (
          <div className="absolute bottom-4 left-4 right-4 z-[1000] md:left-auto md:right-4 md:w-80">
            <Card className="border-border bg-card/95 p-4 backdrop-blur-md shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground">{selectedAsset.hostname}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedAsset.os} • {selectedAsset.cpu_model}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    WiFi: {selectedAsset.wifi_ssid || "N/A"} •{" "}
                    {selectedAsset.ip_addresses?.[0] || "No IP"}
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
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
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