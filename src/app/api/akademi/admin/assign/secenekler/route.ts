import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";

// GET - Yeni Atama modalı segment seçenekleri: departman pill'leri (gerçek personel
// bölümleri = Personnel.bolum; atama personele göre olduğundan bu kaynak eşleşmeyi
// garanti eder) + yaka değerleri.
export async function GET() {
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const rows = await prisma.personnel.findMany({
    where: { aktif: true },
    select: { bolum: true },
    distinct: ["bolum"],
    orderBy: { bolum: "asc" },
  });
  const departmanlar = rows.map((r) => r.bolum).filter(Boolean);

  return NextResponse.json({
    departmanlar,
    yakalar: [
      { value: "BEYAZ", label: "Beyaz" },
      { value: "GRI", label: "Gri" },
      { value: "MAVI", label: "Mavi" },
    ],
  });
}
