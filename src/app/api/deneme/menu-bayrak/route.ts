// GET /api/deneme/menu-bayrak
// Sidebar için IV-FR-27 menü bayrağı — SUNUCUDA hesaplanır (is-analizi deseni).
// İstemci yalnız boolean okur. Görünürlük kuralı Faz 2'deki görünürlükle AYNI:
//   · İV (hr.admin | recruitment.admin) → görür
//   · en az bir formun zincirinde olan (değerlendirici1/2 ya da onaylayan) → görür
//   · başkası → görmez
// Oturum yoksa 401 → Sidebar fetch !ok görür, bayrak false kalır (menü gizli).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { ikMi } from "@/lib/deneme/deneme-yetki";

export const dynamic = "force-dynamic";

export async function GET() {
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  if (ikMi(aktor)) return NextResponse.json({ gorunur: true, kapsam: "tumu" });

  if (!aktor.personnelId) return NextResponse.json({ gorunur: false });

  const sayi = await prisma.denemeDegerlendirme.count({
    where: {
      OR: [
        { degerlendirici1Id: aktor.personnelId },
        { degerlendirici2Id: aktor.personnelId },
        { onaylayanId: aktor.personnelId },
      ],
    },
  });
  return NextResponse.json({ gorunur: sayi > 0, kapsam: "kendi" });
}
