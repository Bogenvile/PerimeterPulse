import { getAuthHeaders } from "./auth";

let currentToken: string | null = null;

export function setApiToken(token: string | null) {
  currentToken = token;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(currentToken),
    ...options?.headers,
  };
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getAssets() {
  return fetchApi("/assets");
}

export async function getAsset(id: string) {
  return fetchApi(`/assets/${id}`);
}

export async function getAssetMetrics(id: string, range = "-1h") {
  return fetchApi(`/assets/${id}/metrics?range=${range}`);
}

export async function getAssetLocations(id: string, range = "-24h") {
  return fetchApi(`/assets/${id}/locations?range=${range}`);
}

export async function deleteAsset(id: string) {
  return fetchApi(`/assets/${id}`, { method: "DELETE" });
}

export async function fetchErrorLogs(id: string, limit = 100) {
  return fetchApi(`/assets/${id}/errors?limit=${limit}`);
}

export async function getApiKeys() {
  return fetchApi("/api-keys");
}

export async function createApiKey(label?: string) {
  return fetchApi("/api-keys/create", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return fetchApi("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function getUsers() {
  return fetchApi("/users");
}

export async function createUser(user: { username: string; display_name?: string; password: string; role: "admin" | "viewer" }) {
  return fetchApi("/users/create", {
    method: "POST",
    body: JSON.stringify(user),
  });
}

export async function deleteUser(id: string) {
  return fetchApi(`/users/${id}`, { method: "DELETE" });
}

export async function sendCommand(assetId: string, command: string) {
  return fetchApi(`/assets/${assetId}/commands`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

export async function getCommandHistory(assetId: string, limit = 50) {
  return fetchApi(`/assets/${assetId}/commands?limit=${limit}`);
}

export async function uploadAgentUpdate(file: File): Promise<{ ok: boolean; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/updates/upload", {
    method: "POST",
    headers: getAuthHeaders(currentToken),
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }

  return res.json();
}

export async function getAgentUpdates(): Promise<
  { filename: string; size: number; createdAt: string }[]
> {
  return fetchApi("/updates");
}