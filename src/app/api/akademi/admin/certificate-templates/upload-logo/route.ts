import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const LOGOS_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "akademi",
  "certificates",
  "logos"
);

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('akademi.cert.manage');
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Geçersiz form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Sadece PNG/JPG kabul edilir" },
      { status: 400 }
    );
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Dosya 2MB'dan büyük olamaz" },
      { status: 400 }
    );
  }

  await fs.mkdir(LOGOS_DIR, { recursive: true });

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg"].includes(ext) ? ext : "png";
  const fileName = `${crypto.randomBytes(9).toString("base64url")}.${safeExt}`;
  const fullPath = path.join(LOGOS_DIR, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(arrayBuffer));

  return NextResponse.json({
    logoPath: `/uploads/akademi/certificates/logos/${fileName}`,
  });
}
