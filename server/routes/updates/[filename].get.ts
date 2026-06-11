import { defineHandler } from "nitro";
import { getRouterParam, createError, setHeaders, sendStream } from "nitro/h3";
import { createReadStream, stat } from "node:fs";
import path from "node:path";

export default defineHandler(async (event) => {
  const filename = getRouterParam(event, "filename");

  // Validasi nama file untuk keamanan (mencegah directory traversal)
  if (!filename || !/^agent-v[\w.-]+-(windows|linux)(\.exe)?$/.test(filename)) {
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }

  // Path ke folder updates di root project
  const filePath = path.join(process.cwd(), "updates", filename);

  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      throw createError({ statusCode: 404, statusMessage: "File not found" });
    }

    setHeaders(event, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(stats.size),
    });

    // Stream file ke client
    return sendStream(event, createReadStream(filePath));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw createError({ statusCode: 404, statusMessage: "Update file not found" });
    }
    throw createError({ statusCode: 500, statusMessage: "Internal Server Error" });
  }
});