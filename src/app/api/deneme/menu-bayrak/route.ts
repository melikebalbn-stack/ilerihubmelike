// GET /api/deneme/menu-bayrak
// Sidebar için IV-FR-27 menü bayrağı — SUNUCUDA hesaplanır (is-analizi deseni).
// İstemci yalnız { gorunur, baslik } okur.
//
// GÖRÜNÜRLÜK (21.09.2026, Melih kararı — "Deneme Formlarım"):
//   • İV (hr.admin | recruitment.admin) → görünür, başlık "Deneme Değerlendirme".
//   • En az bir formun zincirinde olan (degerlendirici1/2 ya da onaylayan) →
//     görünür, başlık "Deneme Formlarım". Kapanmış formlar da sayılır — geçmiş
//     formuna listeden ulaşabilsin.
//   • Aksi → gizli.
// Oturum yoksa 401 → Sidebar fetch !ok görür, bayrak false kalır (menü gizli).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { ikMi } from "@/lib/deneme/deneme-yetki";

export const dynamic = "force-dynamic";

const DENEME_MENU_BASLIK = { iv: "Deneme Değerlendirme", zincir: "Deneme Formlarım" } as const;

export async function GET() {
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  if (ikMi(aktor)) return NextResponse.json({ gorunur: true, baslik: DENEME_MENU_BASLIK.iv });

  const pid = aktor.personnelId;
  if (!pid) return NextResponse.json({ gorunur: false, baslik: null });

  const zincirde = await prisma.denemeDegerlendirme.count({
    where: { OR: [{ degerlendirici1Id: pid }, { degerlendirici2Id: pid }, { onaylayanId: pid }] },
  });
  return NextResponse.json({ gorunur: zincirde > 0, baslik: zincirde > 0 ? DENEME_MENU_BASLIK.zincir : null });
}
