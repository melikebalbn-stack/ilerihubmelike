import { mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "akademi");

export function getUploadSubdir(
  contentType: string
): "videos" | "documents" | "thumbnails" {
  switch (contentType) {
    case "VIDEO":
      return "videos";
    case "PDF":
    case "DOCUMENT":
      return "documents";
    default:
      return "documents";
  }
}

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
    maxSizeMB: 500,
  },
  PDF: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    magicBytes: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
    maxSizeMB: 50,
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
    maxSizeMB: 50,
  },
};

export async function ensureUploadDirs(): Promise<void> {
  const dirs = ["videos", "documents", "thumbnails"];
  await Promise.all(
    dirs.map((d) => mkdir(path.join(UPLOAD_ROOT, d), { recursive: true }))
  );
}

export async function hasSufficientDiskSpace(minBytes: number): Promise<boolean> {
  try {
    const fs = await import("fs/promises");
    const statfsFn = (fs as unknown as { statfs?: (p: string) => Promise<{ bavail: number; bsize: number }> }).statfs;
    if (typeof statfsFn === "function") {
      const stats = await statfsFn(UPLOAD_ROOT);
      const freeBytes = stats.bavail * stats.bsize;
      return freeBytes >= minBytes;
    }
    return true;
  } catch {
    return true;
  }
}

export async function verifyMagicBytes(
  filePath: string,
  config: FileTypeConfig
): Promise<boolean> {
  if (!config.magicBytes || config.magicBytes.length === 0) return true;

  const fs = await import("fs/promises");
  const fd = await fs.open(filePath, "r");
  try {
    const maxRead = Math.max(
      ...config.magicBytes.map((m) => m.offset + m.bytes.length)
    );
    const buffer = Buffer.alloc(maxRead);
    await fd.read(buffer, 0, maxRead, 0);

    return config.magicBytes.some((m) =>
      m.bytes.every((b, i) => buffer[m.offset + i] === b)
    );
  } finally {
    await fd.close();
  }
}

export function generateSafeFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const id = crypto.randomBytes(12).toString("hex");
  return `${id}${ext}`;
}

export function isAllowedExtension(
  fileName: string,
  config: FileTypeConfig
): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return config.extensions.includes(ext);
}

export function isAllowedMimeType(
  mimeType: string,
  config: FileTypeConfig
): boolean {
  return config.mimeTypes.includes(mimeType.toLowerCase());
}

export async function cleanupPartialUpload(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // ignore
  }
}

export function getAbsoluteUploadPath(subdir: string, fileName: string): string {
  return path.join(UPLOAD_ROOT, subdir, fileName);
}
