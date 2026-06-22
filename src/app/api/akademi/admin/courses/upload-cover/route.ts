import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// PR-2: Normal kurs kapak görseli yükleme. IFS kapak yükleme (packages/upload-cover)
// ile AYNI shared storage (public/uploads → /home/rokunet/shared/uploads symlink)
// ve AYNI auth'lu serve route (/api/akademi/files/[...path]). Yeni altyapı KURULMADI;
// yalnız course'a özel dizin (covers packages'a karışmasın).
const COVERS_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "akademi",
  "courses",
  "covers"
);

const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const { error } = await requirePermission("akademi.kurs.edit");
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Sadece PNG/JPG/WEBP/GIF görseller kabul edilir" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Dosya 5MB'dan büyük olamaz" },
      { status: 400 }
    );
  }

  await fs.mkdir(COVERS_DIR, { recursive: true });

  // Orijinal adı sanitize (yalnız görüntü amaçlı) + benzersiz son ek.
  const ext = EXT_BY_TYPE[file.type] ?? "png";
  const base =
    file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "kapak";
  const fileName = `${base}-${crypto.randomBytes(6).toString("base64url")}.${ext}`;
  const fullPath = path.join(COVERS_DIR, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(arrayBuffer));

  // /uploads/... doğrudan servis EDİLMEZ; auth'lu /api/akademi/files/[...path]
  // route'undan (public/uploads/akademi kökü) servis edilir.
  return NextResponse.json({
    url: `/api/akademi/files/courses/covers/${fileName}`,
  });
}
