import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import Busboy from "busboy";
import {
  FILE_CONFIGS,
  ensureUploadDirs,
  hasSufficientDiskSpace,
  verifyMagicBytes,
  generateSafeFileName,
  isAllowedExtension,
  isAllowedMimeType,
  getAbsoluteUploadPath,
  getUploadSubdir,
  cleanupPartialUpload,
} from "@/lib/akademi-upload";

export const runtime = "nodejs";
// 200 MB video yavaş hatta 60 sn'ye sığmıyordu; nginx proxy_read_timeout 300 ile hizalı.
export const maxDuration = 300;

const ALLOWED_TYPES = ["VIDEO", "PDF", "DOCUMENT"] as const;
type ContentType = (typeof ALLOWED_TYPES)[number];

type Outcome =
  | { ok: true; fileName: string; absolutePath: string; size: number; contentType: ContentType }
  | { ok: false; status: number; error: string };

/**
 * GERÇEK STREAM (17.09.2026): `req.formData()` multipart gövdeyi bellekte
 * File/Blob olarak tutuyordu — 165 MB video RSS'i 1013→1402 MB'a çıkardı,
 * PM2 1536M sınırına 134 MB kaldı. Busboy gövdeyi okurken doğrudan diske
 * akıtır; RSS'e dosya boyutu binmez.
 *
 * contentType, dosya parçasından ÖNCE bilinmek zorunda (sınır/uzantı/alt dizin
 * ona bağlı): istemci ?contentType= query'si + form alanını dosyadan önce gönderir.
 */
export async function POST(req: NextRequest) {
  const { error } = await requirePermission("akademi.kurs.edit");
  if (error) return error;

  const ctHeader = req.headers.get("content-type") ?? "";
  if (!ctHeader.toLowerCase().startsWith("multipart/form-data") || !req.body) {
    return NextResponse.json({ error: "Form verisi okunamadı" }, { status: 400 });
  }

  const queryType = req.nextUrl.searchParams.get("contentType") ?? undefined;

  // Yazmadan önce: bildirilen gövde boyutu + 100 MB pay kadar yer var mı.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (!(await hasSufficientDiskSpace((declared || 0) + 100 * 1024 * 1024))) {
    return NextResponse.json(
      { error: "Sunucuda yeterli disk alanı yok" },
      { status: 507 }
    );
  }

  await ensureUploadDirs();

  const outcome = await new Promise<Outcome>((resolve) => {
    let settled = false;
    const done = (o: Outcome) => {
      if (settled) return;
      settled = true;
      resolve(o);
    };

    let contentType: ContentType | undefined = isContentType(queryType)
      ? queryType
      : undefined;
    let fileSeen = false;
    let absolutePath: string | null = null;

    const bb = Busboy({
      headers: { "content-type": ctHeader },
      limits: { files: 1, fields: 5, fieldSize: 1024 },
    });

    bb.on("field", (name, val) => {
      if (name === "contentType" && !contentType && isContentType(val)) {
        contentType = val;
      }
    });

    bb.on("file", (name, stream, info) => {
      if (name !== "file" || fileSeen) {
        stream.resume();
        return;
      }
      fileSeen = true;

      if (!contentType) {
        stream.resume();
        return done({
          status: 400,
          ok: false,
          error: "İçerik tipi (VIDEO/PDF/DOCUMENT) dosyadan önce gönderilmeli",
        });
      }
      const config = FILE_CONFIGS[contentType];
      if (!isAllowedExtension(info.filename, config)) {
        stream.resume();
        return done({
          ok: false,
          status: 400,
          error: `Desteklenmeyen dosya uzantısı. Kabul edilen: ${config.extensions.join(", ")}`,
        });
      }
      if (!isAllowedMimeType(info.mimeType, config)) {
        stream.resume();
        return done({
          ok: false,
          status: 400,
          error: `Desteklenmeyen dosya tipi. Kabul edilen: ${config.mimeTypes.join(", ")}`,
        });
      }

      const maxBytes = config.maxSizeMB * 1024 * 1024;
      const subdir = getUploadSubdir(contentType);
      const fileName = generateSafeFileName(info.filename);
      const target = getAbsoluteUploadPath(subdir, fileName);
      absolutePath = target;

      let written = 0;
      const out = createWriteStream(target, { flags: "wx" });

      let failed = false;
      const fail = async (status: number, message: string) => {
        if (failed) return;
        failed = true;
        stream.unpipe(out);
        stream.resume(); // gövdenin kalanını tüket, bağlantı asılı kalmasın
        out.destroy();
        await cleanupPartialUpload(target);
        done({ ok: false, status, error: message });
      };

      stream.on("data", (chunk: Buffer) => {
        written += chunk.length;
        if (written > maxBytes) {
          void fail(
            413,
            `Dosya çok büyük (maksimum ${config.maxSizeMB} MB — ${Math.round(
              written / 1024 / 1024
            )}+ MB gönderildi)`
          );
        }
      });
      stream.on("error", () => void fail(500, "Yükleme kesildi"));
      out.on("error", () => void fail(500, "Dosya yazılamadı"));
      out.on("finish", () => {
        if (settled) return;
        done({ ok: true, fileName, absolutePath: target, size: written, contentType: contentType as ContentType });
      });

      stream.pipe(out);
    });

    bb.on("error", () => {
      if (absolutePath) void cleanupPartialUpload(absolutePath);
      done({ ok: false, status: 400, error: "Form verisi okunamadı" });
    });
    bb.on("close", () => {
      // Dosya parçası hiç gelmediyse
      if (!fileSeen) done({ ok: false, status: 400, error: "Dosya gerekli" });
    });

    Readable.fromWeb(req.body as import("stream/web").ReadableStream).pipe(bb);
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  const config = FILE_CONFIGS[outcome.contentType];
  const magicOk = await verifyMagicBytes(outcome.absolutePath, config);
  if (!magicOk) {
    await cleanupPartialUpload(outcome.absolutePath);
    return NextResponse.json(
      { error: "Dosya içeriği tipiyle uyuşmuyor (magic bytes)" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    filePath: outcome.fileName,
    fileSize: outcome.size,
    message: "Dosya yüklendi",
  });
}

function isContentType(v: unknown): v is ContentType {
  return typeof v === "string" && (ALLOWED_TYPES as readonly string[]).includes(v);
}
