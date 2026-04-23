import { NextRequest, NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { writeFile } from "fs/promises";
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
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Form verisi okunamadı" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const contentType = formData.get("contentType")?.toString();

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
  }

  if (!contentType || !["VIDEO", "PDF", "DOCUMENT"].includes(contentType)) {
    return NextResponse.json(
      { error: "Geçersiz içerik tipi (VIDEO/PDF/DOCUMENT)" },
      { status: 400 }
    );
  }

  const config = FILE_CONFIGS[contentType];
  if (!config) {
    return NextResponse.json(
      { error: "İçerik tipi desteklenmiyor" },
      { status: 400 }
    );
  }

  if (!isAllowedExtension(file.name, config)) {
    return NextResponse.json(
      {
        error: `Desteklenmeyen dosya uzantısı. Kabul edilen: ${config.extensions.join(
          ", "
        )}`,
      },
      { status: 400 }
    );
  }

  if (!isAllowedMimeType(file.type, config)) {
    return NextResponse.json(
      {
        error: `Desteklenmeyen dosya tipi. Kabul edilen: ${config.mimeTypes.join(
          ", "
        )}`,
      },
      { status: 400 }
    );
  }

  const maxBytes = config.maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `Dosya boyutu ${config.maxSizeMB}MB'yi aşamaz (${Math.round(
          file.size / 1024 / 1024
        )}MB gönderildi)`,
      },
      { status: 413 }
    );
  }

  const hasSpace = await hasSufficientDiskSpace(file.size + 100 * 1024 * 1024);
  if (!hasSpace) {
    return NextResponse.json(
      { error: "Sunucuda yeterli disk alanı yok" },
      { status: 507 }
    );
  }

  await ensureUploadDirs();

  const subdir = getUploadSubdir(contentType);
  const fileName = generateSafeFileName(file.name);
  const absolutePath = getAbsoluteUploadPath(subdir, fileName);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);
  } catch {
    await cleanupPartialUpload(absolutePath);
    return NextResponse.json({ error: "Dosya yazılamadı" }, { status: 500 });
  }

  const magicOk = await verifyMagicBytes(absolutePath, config);
  if (!magicOk) {
    await cleanupPartialUpload(absolutePath);
    return NextResponse.json(
      { error: "Dosya içeriği tipiyle uyuşmuyor (magic bytes)" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    filePath: fileName,
    fileSize: file.size,
    message: "Dosya yüklendi",
  });
}
