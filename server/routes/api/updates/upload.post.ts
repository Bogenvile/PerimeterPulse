import { defineHandler } from "nitro";
import { readMultipartFormData, createError } from "nitro/h3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default defineHandler(async (event) => {
  const formData = await readMultipartFormData(event);
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: "No file provided" });
  }

  const filePart = formData.find((part) => part.filename && part.name === "file");
  if (!filePart || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: "Invalid file" });
  }

  // Validasi nama file: agent-v{VERSI}-{OS}.exe
  const filename = filePart.filename;
  const regex = /^agent-v[\d.]+-(windows|linux)(\.exe)?$/;
  if (!regex.test(filename)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid filename. Use format: agent-vX.Y.Z-windows.exe or agent-vX.Y.Z-linux",
    });
  }

  try {
    const updatesDir = path.join(process.cwd(), "updates");
    await mkdir(updatesDir, { recursive: true });

    const filePath = path.join(updatesDir, filename);
    await writeFile(filePath, Buffer.from(filePart.data));

    return { ok: true, filename, size: filePart.data.length };
  } catch (err: unknown) {
    console.error("Upload error:", err);
    throw createError({ statusCode: 500, statusMessage: "Failed to save file" });
  }
});