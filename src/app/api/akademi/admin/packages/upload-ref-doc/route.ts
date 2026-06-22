import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// IFS paket referans PDF yükleme. Kapak görseli (upload-cover) deseniyle birebir
// (public/uploads/akademi → shared/uploads symlink). Yeni altyapı KURULMADI.
// Yalnız application/pdf kabul edilir. Kayıt (PackageReferenceDoc) paket
// kaydedilirken oluşturulur; burada yalnız dosya diske yazılır ve URL döner.
const REF_DOCS_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "akademi",
  "packages",
  "ref-docs"
);

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

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

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Sadece PDF kabul edilir" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Dosya 20MB'dan büyük olamaz" },
      { status: 400 }
    );
  }

  await fs.mkdir(REF_DOCS_DIR, { recursive: true });

  const fileName = `${crypto.randomBytes(9).toString("base64url")}.pdf`;
  const fullPath = path.join(REF_DOCS_DIR, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(arrayBuffer));

  // /uploads/... doğrudan servis EDİLMEZ; auth'lu /api/akademi/files/[...path]
  // route'undan (public/uploads/akademi kökü) servis edilir.
  return NextResponse.json({
    fileUrl: `/api/akademi/files/packages/ref-docs/${fileName}`,
  });
}
