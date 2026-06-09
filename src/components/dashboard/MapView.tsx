import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AgentStatus } from "@/lib/types";

interface MappableAsset {
  id: string;
  hostname: string;
  os: string;
  status: AgentStatus;
  last_location_lat: number | null;
  last_location_lng: number | null;
}

// Inline SVG marker icon sebagai data URI — tidak perlu import file gambar
const defaultIconSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path fill="#3b82f6" stroke="#fff" stroke-width="2" d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
    <circle cx="12.5" cy="12.5" r="5" fill="#fff"/>
  </svg>`
);

const defaultIcon = L.icon({
  iconUrl: `data:image/svg+xml,${defaultIconSvg}`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "",
});

const statusColors: Record<string, string> = {
  online: "#10b981",
  offline: "#ef4444",
  warning: "#f59e0b",
  critical: "#f97316",
};

function createMarkerIcon(status: string) {
  const color = statusColors[status] || "#6b7280";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path fill="${color}" stroke="#fff" stroke-width="2" d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
    <circle cx="12.5" cy="12.5" r="5" fill="#fff"/>
  </svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: "",
  });
}

interface MapViewProps {
  assets: MappableAsset[];
  onAssetClick?: (asset: MappableAsset) => void;
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
    (asset: MappableAsset) => {
      if (onAssetClick) onAssetClick(asset);
    },
    [onAssetClick],
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
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
    } catch (err) {
      console.error("MapView init error:", err);
    }

    return () => {
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  // Update markers when assets change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers safely
    try {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    } catch {
      markersRef.current = [];
    }

    const validAssets = assets.filter(
      (a) =>
        a.last_location_lat != null &&
        a.last_location_lng != null &&
        !isNaN(a.last_location_lat) &&
        !isNaN(a.last_location_lng),
    );

    if (validAssets.length === 0) return;

    validAssets.forEach((asset) => {
      try {
        const marker = L.marker(
          [asset.last_location_lat!, asset.last_location_lng!],
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
      } catch (err) {
        console.warn("Failed to add marker for asset:", asset.id, err);
      }
    });

    // Fit bounds
    try {
      const bounds = L.latLngBounds(
        validAssets.map((a) => [a.last_location_lat!, a.last_location_lng!] as [number, number]),
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    } catch {
      // ignore bounds errors
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