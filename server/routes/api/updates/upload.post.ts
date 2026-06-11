import { defineHandler } from "nitro";
import { readMultipartFormData, createError } from "nitro/h3";
import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export default defineHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event);
    if (!formData || formData.length === 0) {
      throw createError({ statusCode: 400, statusMessage: "No file provided" });
    }

    // Cari file part dengan nama "file"
    const filePart = formData.find(
      (part) => part.name === "file" && part.filename && part.data?.length > 0,
    );

    if (!filePart || !filePart.filename) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid file. Use field name 'file' with a valid filename.",
      });
    }

    const filename = filePart.filename;
    const regex = /^agent-v[\d.]+-(windows|linux)(\.exe)?$/;
    if (!regex.test(filename)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid filename "${filename}". Use format: agent-vX.Y.Z-windows.exe or agent-vX.Y.Z-linux`,
      });
    }

    // Tentukan direktori updates
    const updatesDir = path.join(process.cwd(), "updates");

    // Buat direktori dengan recursive, izinkan jika sudah ada
    try {
      await mkdir(updatesDir, { recursive: true });
    } catch (mkdirErr: unknown) {
      console.error("Failed to create updates directory:", mkdirErr);
      throw createError({
        statusCode: 500,
        statusMessage: "Server configuration error: cannot create updates directory",
      });
    }

    // Verifikasi direktori bisa ditulis
    try {
      await access(updatesDir, constants.W_OK);
    } catch {
      console.error("Updates directory is not writable:", updatesDir);
      throw createError({
        statusCode: 500,
        statusMessage: "Server configuration error: updates directory not writable",
      });
    }

    const filePath = path.join(updatesDir, filename);
    await writeFile(filePath, Buffer.from(filePart.data));

    console.log(`Agent update uploaded: ${filename} (${filePart.data.length} bytes)`);

    return {
      ok: true,
      filename,
      size: filePart.data.length,
      message: `Successfully uploaded ${filename}`,
    };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "statusCode" in err) {
      throw err; // Re-throw createError
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Upload error:", msg, err);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save file: ${msg}`,
    });
  }
});