import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// IFS kart kapak görseli yükleme. Mevcut cert-logo upload deseniyle birebir
// (public/uploads → shared/uploads symlink). Yeni altyapı KURULMADI.
const COVERS_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "akademi",
  "packages",
  "covers"
);

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

  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Sadece PNG/JPG/WEBP kabul edilir" },
      { status: 400 }
    );
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Dosya 4MB'dan büyük olamaz" },
      { status: 400 }
    );
  }

  await fs.mkdir(COVERS_DIR, { recursive: true });

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
  const fileName = `${crypto.randomBytes(9).toString("base64url")}.${safeExt}`;
  const fullPath = path.join(COVERS_DIR, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(arrayBuffer));

  // Bu projede /uploads/... doğrudan servis EDİLMEZ; dosyalar auth'lu
  // /api/akademi/files/[...path] route'undan (public/uploads/akademi kökü) servis edilir.
  return NextResponse.json({
    coverImageUrl: `/api/akademi/files/packages/covers/${fileName}`,
  });
}
