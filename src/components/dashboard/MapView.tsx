import { useEffect, useRef, useCallback, useState } from "react";
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
  last_seen_at?: string | null;
  wifi_ssid?: string;
  city?: string;
  country?: string;
}

const statusColors: Record<string, string> = {
  online: "#10b981",
  offline: "#6b7280",
  warning: "#f59e0b",
  critical: "#ef4444",
};

function createMarkerIcon(status: string): L.DivIcon {
  const color = statusColors[status] || "#6b7280";
  const uid = "f" + Math.random().toString(36).slice(2, 8);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <defs>
      <filter id="${uid}" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${color}" flood-opacity="0.35"/>
      </filter>
    </defs>
    <path fill="${color}" stroke="#fff" stroke-width="2" d="M14 0C6.3 0 0 6.3 0 14C0 24.5 14 44 14 44S28 24.5 28 14C28 6.3 21.7 0 14 0z" filter="url(#${uid})"/>
    <circle cx="14" cy="14" r="5.5" fill="#fff" opacity="0.95"/>
  </svg>`;
  return L.divIcon({
    html: `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" style="width:28px;height:44px;" />`,
    iconSize: [28, 44],
    iconAnchor: [14, 44],
    popupAnchor: [0, -40],
    className: "",
  });
}

function createPulseIcon(status: string): L.DivIcon {
  const color = statusColors[status] || "#6b7280";
  return L.divIcon({
    html: `<div style="position:relative;width:28px;height:44px;">
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:${color};opacity:0.3;animation:pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite;"/>
    </div>`,
    iconSize: [28, 44],
    iconAnchor: [14, 44],
    className: "",
  });
}

function formatLastSeen(iso: string | null | undefined): string {
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
  center = [20, 0],
  zoom = 2,
  className = "",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup>(L.layerGroup());
  const initRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const handleAssetClick = useCallback(
    (asset: MappableAsset) => {
      if (onAssetClick) onAssetClick(asset);
    },
    [onAssetClick],
  );

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      markersRef.current.addTo(map);
      mapRef.current = map;

      requestAnimationFrame(() => {
        map.invalidateSize();
        setMapReady(true);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {
        // ignore
      }
      initRef.current = false;
      setMapReady(false);
    };
  }, []);

  // Place markers whenever map is ready or assets change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.clearLayers();

    const validAssets = assets.filter(
      (a) =>
        a.last_location_lat != null &&
        a.last_location_lng != null &&
        !isNaN(a.last_location_lat) &&
        !isNaN(a.last_location_lng),
    );

    if (validAssets.length === 0) return;

    validAssets.forEach((asset) => {
      const lat = asset.last_location_lat!;
      const lng = asset.last_location_lng!;
      const color = statusColors[asset.status] || "#6b7280";
      const lastSeen = formatLastSeen(asset.last_seen_at);
      const location = [asset.city, asset.country].filter(Boolean).join(", ");

      const marker = L.marker([lat, lng], {
        icon: createMarkerIcon(asset.status),
      });

      if (asset.status === "online") {
        L.marker([lat, lng], { icon: createPulseIcon(asset.status), interactive: false })
          .addTo(markersRef.current);
      }

      marker.bindPopup(
        `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:160px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;${asset.status === 'online' ? 'box-shadow:0 0 6px ' + color : ''}"></span>
            <strong style="font-size:13px;color:#1a1a2e">${asset.hostname}</strong>
          </div>
          <div style="font-size:11px;color:#666;line-height:1.7">
            ${asset.os}<br/>
            ${asset.wifi_ssid || "No WiFi"} · <span style="color:${color}">${lastSeen}</span>
            ${location ? `<br/>📍 ${location}` : ""}
          </div>
        </div>`,
        { maxWidth: 260 },
      );

      marker.on("click", () => handleAssetClick(asset));
      marker.addTo(markersRef.current);
    });

    try {
      const bounds = L.latLngBounds(
        validAssets.map((a) => [a.last_location_lat!, a.last_location_lng!] as [number, number]),
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    } catch {
      // ignore
    }

    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [assets, handleAssetClick, mapReady]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 300 }}
    />
  );
}