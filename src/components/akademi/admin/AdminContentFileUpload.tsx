"use client";

import { useState, useRef } from "react";
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AdminContentType } from "@/types/akademi-admin";

interface Props {
  contentType: AdminContentType;
  onUploaded: (data: { filePath: string; fileSize: number }) => void;
  currentFilePath?: string | null;
  disabled?: boolean;
}

const ACCEPT_MAP: Record<string, string> = {
  VIDEO: "video/mp4,video/webm",
  PDF: "application/pdf",
  DOCUMENT:
    "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  QUIZ: "",
};

const MAX_MB_MAP: Record<string, number> = {
  VIDEO: 500,
  PDF: 50,
  DOCUMENT: 50,
  QUIZ: 0,
};

export function AdminContentFileUpload({
  contentType,
  onUploaded,
  currentFilePath,
  disabled = false,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState<{
    filePath: string;
    fileSize: number;
  } | null>(currentFilePath ? { filePath: currentFilePath, fileSize: 0 } : null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = ACCEPT_MAP[contentType] ?? "";
  const maxMB = MAX_MB_MAP[contentType] ?? 0;

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(0);

    if (file.size > maxMB * 1024 * 1024) {
      const msg = `Dosya boyutu ${maxMB}MB'yi aşamaz`;
      setError(msg);
      toast.error(msg);
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("contentType", contentType);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/akademi/admin/contents/upload");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);
        }
      };

      const result: { filePath: string; fileSize: number } = await new Promise(
        (resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new Error("Geçersiz sunucu yanıtı"));
              }
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                reject(new Error(err.error || `HTTP ${xhr.status}`));
              } catch {
                reject(new Error(`HTTP ${xhr.status}`));
              }
            }
          };
          xhr.onerror = () => reject(new Error("Ağ hatası"));
          xhr.onabort = () => reject(new Error("Yükleme iptal edildi"));
          xhr.send(formData);
        }
      );

      setUploaded(result);
      onUploaded(result);
      toast.success("Dosya yüklendi");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Yükleme başarısız";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setUploaded(null);
    setError(null);
    onUploaded({ filePath: "", fileSize: 0 });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {uploaded && !uploading && (
        <div
          className="flex items-center gap-3 p-3 rounded-md"
          style={{ background: "var(--ak-green-glow)" }}
        >
          <CheckCircle2
            className="w-5 h-5 shrink-0"
            style={{ color: "var(--ak-green)" }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {uploaded.filePath}
            </div>
            {uploaded.fileSize > 0 && (
              <div className="text-xs text-gray-500">
                {(uploaded.fileSize / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 hover:bg-red-50 rounded"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      )}

      {!uploaded && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            disabled
              ? "opacity-60 cursor-not-allowed"
              : "cursor-pointer hover:border-blue-400"
          }`}
          style={{
            borderColor: error ? "#ef4444" : "var(--ak-border-divider)",
          }}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={accept}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            disabled={disabled || uploading}
          />

          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
              <div className="text-sm text-gray-600">
                Yükleniyor... %{progress}
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-gray-400" />
              <div className="text-sm font-semibold">
                Dosyayı sürükle-bırak veya tıkla
              </div>
              <div className="text-xs text-gray-500">Maksimum {maxMB} MB</div>
            </div>
          )}

          {error && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-600 justify-center">
              <AlertCircle className="w-3 h-3" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
