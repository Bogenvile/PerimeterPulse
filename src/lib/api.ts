import { getAuthHeaders } from "./auth";
import type { ExtendedAsset, MetricsDataPoint, LocationDataPoint, ApiKeyInfo, ErrorLogItem } from "./types";

const API_BASE = "/api";

let currentToken: string | null = null;

export function setApiToken(token: string | null) {
  currentToken = token;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(currentToken),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getAssets(): Promise<ExtendedAsset[]> {
  return fetchApi<ExtendedAsset[]>("/assets");
}

export async function getAsset(id: string): Promise<ExtendedAsset> {
  return fetchApi<ExtendedAsset>(`/assets/${encodeURIComponent(id)}`);
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

export async function getApiKeys(): Promise<ApiKeyInfo[]> {
  return fetchApi<ApiKeyInfo[]>("/api-keys");
}

export async function createApiKey(label?: string): Promise<{
  id: string;
  api_key: string;
  key_prefix: string;
  label: string;
  warning: string;
}> {
  return fetchApi("/api-keys/create", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function fetchErrorLogs(
  id: string,
  limit?: number,
): Promise<ErrorLogItem[]> {
  const params = limit ? `?limit=${limit}` : "";
  return fetchApi<ErrorLogItem[]>(
    `/assets/${encodeURIComponent(id)}/errors${params}`,
  );
}
