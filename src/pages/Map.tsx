import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium text-destructive">{error}</p>
      </div>
    );
  }

  if (assetsWithLocation.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <MapPin className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-bold text-foreground">No Location Data</p>
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
            <div className="rounded-xl border border-border bg-card p-4 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm">{selectedAsset.hostname}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedAsset.os} · {selectedAsset.cpu_model}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    WiFi: {selectedAsset.wifi_ssid || "N/A"} · {selectedAsset.ip_addresses?.[0] || "No IP"}
                  </p>
                </div>
                <AgentStatusBadge status={selectedAsset.status} size="sm" />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => navigate(`/assets/${selectedAsset.id}`)}
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;