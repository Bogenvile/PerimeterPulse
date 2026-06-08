import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Asset } from "@/lib/types";

// Fix default Leaflet icon paths
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// @ts-expect-error Leaflet icon types
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const statusColors: Record<string, string> = {
  online: "#10b981",
  offline: "#ef4444",
  warning: "#f59e0b",
  critical: "#f97316",
};

function createMarkerIcon(status: string) {
  const color = statusColors[status] || "#6b7280";
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 14px; height: 14px;
      background: ${color};
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 10px ${color}66, 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

interface MapViewProps {
  assets: Asset[];
  onAssetClick?: (asset: Asset) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export function MapView({
  assets,
  onAssetClick,
  center = [40, -40],
  zoom = 2,
  className = "",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const handleAssetClick = useCallback(
    (asset: Asset) => {
      if (onAssetClick) onAssetClick(asset);
    },
    [onAssetClick],
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when assets change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    assets.forEach((asset) => {
      if (
        asset.last_location_lat == null ||
        asset.last_location_lng == null
      )
        return;

      const marker = L.marker(
        [asset.last_location_lat, asset.last_location_lng],
        { icon: createMarkerIcon(asset.status) },
      )
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;font-size:13px;color:#e2e8f0">
            <strong>${asset.hostname}</strong><br/>
            <span style="font-size:11px;color:#94a3b8">${asset.os} — ${asset.status}</span>
          </div>`,
        )
        .addTo(map);

      marker.on("click", () => handleAssetClick(asset));
      markersRef.current.push(marker);
    });

    // Fit bounds if there are markers
    const validAssets = assets.filter(
      (a) => a.last_location_lat != null && a.last_location_lng != null,
    );
    if (validAssets.length > 0) {
      const bounds = L.latLngBounds(
        validAssets.map((a) => [a.last_location_lat!, a.last_location_lng!] as [number, number]),
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    }
  }, [assets, handleAssetClick]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-xl border border-white/[0.06] ${className}`}
      style={{ minHeight: 400 }}
    />
  );
}
