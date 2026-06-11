import { getAuthHeaders } from "./auth";

// ... keep existing code ...

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