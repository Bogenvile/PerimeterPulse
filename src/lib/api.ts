import type { Asset, MetricsDataPoint, LocationDataPoint } from "./types";

const API_BASE = "/api";

// In production, the API key would be stored in session/local storage after login.
// For the dashboard demo, we use a hardcoded key that matches the dev setup.
let apiKey = "";

export function setApiKey(key: string) {
  apiKey = key;
}

async function fetchApi<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getAssets(): Promise<Asset[]> {
  return fetchApi<Asset[]>("/assets");
}

export async function getAsset(id: string): Promise<Asset> {
  return fetchApi<Asset>(`/assets/${encodeURIComponent(id)}`);
}

export async function getAssetMetrics(
  id: string,
  range?: string,
): Promise<MetricsDataPoint[]> {
  const params = range ? `?range=${encodeURIComponent(range)}` : "";
  return fetchApi<MetricsDataPoint[]>(
    `/assets/${encodeURIComponent(id)}/metrics${params}`,
  );
}

export async function getAssetLocations(
  id: string,
  range?: string,
): Promise<LocationDataPoint[]> {
  const params = range ? `?range=${encodeURIComponent(range)}` : "";
  return fetchApi<LocationDataPoint[]>(
    `/assets/${encodeURIComponent(id)}/locations${params}`,
  );
}
