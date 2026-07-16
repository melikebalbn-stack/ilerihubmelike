import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUBLIC (auth'suz) — başvuru formundaki "Bize Nasıl Ulaştınız" seçenekleri.
// Yalnız aktif kaynak sözlüğü adları döner. Aday erişimi; hassas veri yok.
export async function GET() {
  const items = await prisma.referralSourceDef.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  // FormSegmentControl {value,label} bekler — value = ad (backend ada göre id çözer).
  return NextResponse.json(items.map((i) => ({ value: i.name, label: i.name })));
}
