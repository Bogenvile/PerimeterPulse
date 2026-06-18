import { defineHandler } from "nitro";
import { getRouterParam, createError, setHeaders } from "nitro/h3";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export default defineHandler(async (event) => {
  const filename = getRouterParam(event, "filename");

  if (!filename || !/^agent-v[\w.-]+-(windows|linux)(\.exe)?$/.test(filename)) {
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }

  const updatesDir = path.resolve(process.cwd(), "updates");
  const filePath = path.join(updatesDir, filename);

  console.log(`[updates] Serving: ${filePath} (cwd: ${process.cwd()})`);

  if (!existsSync(filePath)) {
    console.error(`[updates] File not found: ${filePath}`);
    throw createError({ statusCode: 404, statusMessage: `Update file not found: ${filename}` });
  }

  try {
    const fileBuffer = readFileSync(filePath);

    setHeaders(event, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(fileBuffer.length),
    });

    return new Uint8Array(fileBuffer);
  } catch (err) {
    console.error(`[updates] Error serving ${filePath}:`, err);
    throw createError({ statusCode: 500, statusMessage: "Failed to read update file" });
  }
});
