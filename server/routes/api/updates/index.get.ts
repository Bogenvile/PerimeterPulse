import { defineHandler } from "nitro";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export default defineHandler(async () => {
  const updatesDir = path.join(process.cwd(), "updates");
  
  try {
    const files = await readdir(updatesDir);
    const updates = await Promise.all(
      files
        .filter((f) => /^agent-v[\d.]+-(windows|linux)(\.exe)?$/.test(f))
        .map(async (f) => {
          const s = await stat(path.join(updatesDir, f));
          return {
            filename: f,
            size: s.size,
            createdAt: s.birthtime.toISOString(),
          };
        }),
    );

    // Sort berdasarkan nama (versi) descending
    return updates.sort((a, b) => b.filename.localeCompare(a.filename));
  } catch {
    return [];
  }
});