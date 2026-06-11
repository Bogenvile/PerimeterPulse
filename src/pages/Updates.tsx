import { useState, useEffect, useCallback } from "react";
import { getAgentUpdates, uploadAgentUpdate, setApiToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { showSuccess, showError } from "@/utils/toast";
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  Info,
  ArrowDownToLine,
  Package,
  AlertTriangle,
} from "lucide-react";

export default function UpdatesPage() {
  const { token, isAdmin } = useAuth();
  const [files, setFiles] = useState<{ filename: string; size: number; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fetchUpdates = useCallback(() => {
    if (!token) return;
    setApiToken(token);
    setLoading(true);
    getAgentUpdates()
      .then(setFiles)
      .catch((e) => showError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const handleFile = async (file: File) => {
    if (!file.name.match(/^agent-v[\d.]+-(windows|linux)(\.exe)?$/)) {
      showError("Nama file harus mengikuti format: agent-vX.Y.Z-windows.exe");
      return;
    }

    setUploading(true);
    try {
      await uploadAgentUpdate(file);
      showSuccess(`Berhasil upload ${file.name}`);
      fetchUpdates();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Akses Admin diperlukan.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 p-6 md:p-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Agent Updates</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola dan distribusikan pembaruan binary agent secara otomatis.
        </p>
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-start gap-3 p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Bagaimana Cara Kerjanya?</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Agent mengecek versi terbaru ke server setiap kali heartbeat (60 detik).</li>
              <li>Jika versi di server lebih baru dari versi yang terinstall, agent akan otomatis mendownload binary.</li>
              <li>Setelah download selesai, agent akan mengganti file dirinya sendiri dan melakukan restart otomatis.</li>
              <li>Nama file harus mengikuti format: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-xs">agent-vX.Y.Z-windows.exe</code></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`relative rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".exe, application/octet-stream"
          onChange={handleChange}
          disabled={uploading}
        />
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <ArrowDownToLine className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-sm font-semibold text-primary hover:underline">
              Klik untuk upload
            </span>
          </label>
          <p className="text-xs text-muted-foreground mt-1">atau drag & drop file di sini</p>
        </div>
      </div>

      {/* File List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Available Updates</h3>
          </div>
          <span className="text-xs text-muted-foreground">{files.length} version{files.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Belum ada update yang diupload</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {files.map((f) => (
              <div key={f.filename} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate font-mono">{f.filename}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(f.size)} · {new Date(f.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-800">Penting</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Pastikan Anda menguji versi baru pada satu agent sebelum mendistribusikannya ke semua perangkat.
          </p>
        </div>
      </div>
    </div>
  );
}