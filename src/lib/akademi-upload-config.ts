/**
 * Akademi içerik yükleme sınırları — TEK KAYNAK (istemci + sunucu).
 * fs/crypto içermez; AdminContentFileUpload (client) buradan okur,
 * akademi-upload.ts (server) yeniden dışa aktarır.
 *
 * Sınır zinciri (16.09.2026): nginx /api/akademi/admin/contents/upload
 * location'ı 220M (multipart payı) → uygulama VIDEO 200 MB, PDF/DOCUMENT 45 MB.
 * Genel nginx location / 50M'de kalır; bu sayıları değiştirirken nginx'i de değiştir.
 */
export interface FileTypeConfig {
  extensions: string[];
  mimeTypes: string[];
  magicBytes?: { offset: number; bytes: number[] }[];
  maxSizeMB: number;
}

export const FILE_CONFIGS: Record<string, FileTypeConfig> = {
  VIDEO: {
    extensions: [".mp4", ".webm"],
    mimeTypes: ["video/mp4", "video/webm"],
    magicBytes: [
      { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
      { offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
    ],
    maxSizeMB: 200,
  },
  PDF: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    magicBytes: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
    maxSizeMB: 45,
  },
  DOCUMENT: {
    extensions: [".pdf", ".docx", ".pptx", ".xlsx"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    magicBytes: [
      { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
      { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
    ],
    maxSizeMB: 45,
  },
};

/** İçerik tipi için MB sınırı; tanımsız tip (QUIZ/GOREV) → 0 (yükleme yok). */
export function maxUploadMB(contentType: string): number {
  return FILE_CONFIGS[contentType]?.maxSizeMB ?? 0;
}
