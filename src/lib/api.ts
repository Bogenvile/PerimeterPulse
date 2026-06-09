import { getAuthHeaders } from "./auth";
import type { ExtendedAsset, MetricsDataPoint, LocationDataPoint, ApiKeyInfo, ErrorLogItem, AgentCommand } from "./types";

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

export async function deleteAsset(id: string): Promise<void> {
  await fetchApi(`/assets/${encodeURIComponent(id)}`, { method: "DELETE" });
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

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await fetchApi("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export interface UserInfo {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export async function getUsers(): Promise<UserInfo[]> {
  return fetchApi<UserInfo[]>("/users");
}

export async function createUser(data: {
  username: string;
  display_name?: string;
  password: string;
  role: "admin" | "viewer";
}): Promise<{ ok: boolean; id: number; username: string }> {
  return fetchApi("/users/create", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await fetchApi(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ──── Remote Command API ────

export async function sendCommand(
  assetId: string,
  command: string,
): Promise<AgentCommand> {
  return fetchApi<AgentCommand>(`/assets/${encodeURIComponent(assetId)}/commands`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

export async function getCommandHistory(
  assetId: string,
  limit?: number,
): Promise<AgentCommand[]> {
  const params = limit ? `?limit=${limit}` : "";
  return fetchApi<AgentCommand[]>(
    `/assets/${encodeURIComponent(assetId)}/commands${params}`,
  );
}