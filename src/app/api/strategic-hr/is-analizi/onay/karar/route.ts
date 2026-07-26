// POST /api/strategic-hr/is-analizi/onay/karar
// Amir kararı: ONAYLA veya GERI_GONDER + amirNotu.
// Body: { id, karar: "ONAYLA" | "GERI_GONDER", amirNotu?: string }
//
// Durum geçişleri:
//   ONAYLA       → IK_INCELEMESINDE  (amirNotu opsiyonel)
//   GERI_GONDER  → REVIZE_ISTENDI    (amirNotu ZORUNLU)
//
// Yetki: yalnız formun amiri. Ön koşul: durum = AMIR_ONAYINDA.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle, iaYetkisiz } from "@/lib/is-analizi/ia-yetki";


export async function POST(req: NextRequest) {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;
  if (!rol.amir) return iaYetkisiz();

  const personnelId = rol.personnelId;
  if (!personnelId) {
    return NextResponse.json({ error: "Personel kaydınız bulunamadı." }, { status: 404 });
  }

  const body = await req.json();
  const { id, karar } = body;
  const amirNotu: string | null = (body.amirNotu ?? "").trim() || null;

  if (!id || (karar !== "ONAYLA" && karar !== "GERI_GONDER")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (karar === "GERI_GONDER" && !amirNotu) {
    return NextResponse.json(
      { error: "Geri gönderirken eksik/gerekçe notu zorunludur." },
      { status: 400 }
    );
  }

  try {
    const form = await prisma.iaIsAnalizi.findUnique({
      where: { id },
      select: { id: true, amirPersonnelId: true, durum: true },
    });
    if (!form) {
      return NextResponse.json({ error: "Form bulunamadı." }, { status: 404 });
    }
    // Yetki
    if (form.amirPersonnelId !== personnelId) {
      return NextResponse.json({ error: "Bu form üzerinde yetkiniz yok." }, { status: 403 });
    }
    // Ön koşul: yalnız amir onayında olan formlar işlenebilir
    if (form.durum !== "AMIR_ONAYINDA") {
      return NextResponse.json(
        { error: "Bu form artık amir onayında değil." },
        { status: 409 }
      );
    }

    const yeniDurum = karar === "ONAYLA" ? "IK_INCELEMESINDE" : "REVIZE_ISTENDI";

    const guncel = await prisma.iaIsAnalizi.update({
      where: { id },
      data: {
        durum: yeniDurum,
        amirNotu: amirNotu,
        amirOnayTarihi: new Date(),
      },
      select: { id: true, durum: true, amirNotu: true },
    });

    return NextResponse.json(guncel);
  } catch (err) {
    console.error("[onay/karar] hata:", err);
    return NextResponse.json({ error: "Karar kaydedilemedi." }, { status: 500 });
  }
}
