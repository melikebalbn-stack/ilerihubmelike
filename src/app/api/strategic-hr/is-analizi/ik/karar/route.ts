// POST /api/strategic-hr/is-analizi/ik/karar
// İK kararı: ONAYLA (→ONAYLANDI) veya GERI_GONDER (→REVIZE_ISTENDI) + ikNotu.
// Body: { id, karar: "ONAYLA" | "GERI_GONDER", ikNotu?: string }
//
// Erişim: İK yetkisi (rol). Ön koşul: durum = IK_INCELEMESINDE.
// GERI_GONDER'de ikNotu zorunlu (çalışan revizyonu için).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle, iaYetkisiz } from "@/lib/is-analizi/ia-yetki";


export async function POST(req: NextRequest) {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;

  if (!rol.ik) return iaYetkisiz();

  const body = await req.json();
  const { id, karar } = body;
  const ikNotu: string | null = (body.ikNotu ?? "").trim() || null;

  if (!id || (karar !== "ONAYLA" && karar !== "GERI_GONDER")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (karar === "GERI_GONDER" && !ikNotu) {
    return NextResponse.json({ error: "Geri gönderirken not zorunludur." }, { status: 400 });
  }

  try {
    const form = await prisma.iaIsAnalizi.findUnique({
      where: { id },
      select: { id: true, durum: true },
    });
    if (!form) {
      return NextResponse.json({ error: "Form bulunamadı." }, { status: 404 });
    }
    if (form.durum !== "IK_INCELEMESINDE") {
      return NextResponse.json({ error: "Bu form artık İK incelemesinde değil." }, { status: 409 });
    }

    const yeniDurum = karar === "ONAYLA" ? "ONAYLANDI" : "REVIZE_ISTENDI";

    const guncel = await prisma.iaIsAnalizi.update({
      where: { id },
      data: {
        durum: yeniDurum,
        ikNotu: ikNotu,
        ikOnayTarihi: new Date(),
      },
      select: { id: true, durum: true, ikNotu: true },
    });

    return NextResponse.json(guncel);
  } catch (err) {
    console.error("[ik/karar] hata:", err);
    return NextResponse.json({ error: "Karar kaydedilemedi." }, { status: 500 });
  }
}
