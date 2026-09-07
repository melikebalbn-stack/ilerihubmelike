// POST /api/deneme/[id]/onayla — ONAY_BEKLIYOR aşaması.
// Onaylayan PUAN VERMEZ: onayla → İK, ya da geri gönder → bir önceki adım.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { adimSahibiMi, denemeRedLog } from "@/lib/deneme/deneme-yetki";
import { gecisIzinli } from "@/lib/deneme/deneme-transitions";
import type { DenemeDurum } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const govde = z.object({
  karar: z.enum(["ONAYLA", "GERI_GONDER"]),
  not: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  const parsed = govde.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    denemeRedLog({ uc: "onayla", formId: id, from: "(okunmadı)", to: "-", reason: "gövde şeması geçersiz", user: aktor.email });
    return NextResponse.json({ error: "Geçersiz istek gövdesi", detay: parsed.error.flatten() }, { status: 400 });
  }
  const { karar, not } = parsed.data;

  const form = await prisma.denemeDegerlendirme.findUnique({
    where: { id },
    select: { id: true, durum: true, personnelId: true, yakaRengi: true, degerlendirici1Id: true, degerlendirici2Id: true, onaylayanId: true, degerlendirici2Rol: true },
  });
  if (!form) return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 });

  if (form.durum !== "ONAY_BEKLIYOR") {
    denemeRedLog({ uc: "onayla", formId: id, from: form.durum, to: "-", reason: "durum onaya uygun değil", user: aktor.email });
    return NextResponse.json({ error: "Form onay aşamasında değil" }, { status: 400 });
  }
  if (!adimSahibiMi(form, aktor)) {
    denemeRedLog({ uc: "onayla", formId: id, from: form.durum, to: "-", reason: "adım sahibi değil", user: aktor.email });
    return NextResponse.json({ error: "Bu formu onaylama yetkiniz yok" }, { status: 403 });
  }

  // Geri gönderim hedefi: mavi yakada 2. puanı veren adıma, beyaz/gri yakada 1. adıma.
  const hedef: DenemeDurum =
    karar === "ONAYLA"
      ? "IK_BEKLIYOR"
      : form.yakaRengi === "MAVI" && form.degerlendirici2Rol === "MUDUR_YARDIMCISI"
        ? "MUDUR_YRD_BEKLIYOR"
        : "DEGERLENDIRICI1_BEKLIYOR";

  if (karar === "GERI_GONDER" && !not?.trim()) {
    denemeRedLog({ uc: "onayla", formId: id, from: form.durum, to: hedef, reason: "geri gönderme gerekçesi boş", user: aktor.email });
    return NextResponse.json({ error: "Geri gönderme için gerekçe zorunludur" }, { status: 400 });
  }
  if (!gecisIzinli(form.durum, "ONAYLAYAN", hedef)) {
    denemeRedLog({ uc: "onayla", formId: id, from: form.durum, to: hedef, reason: "geçiş matriste izinli değil", user: aktor.email });
    return NextResponse.json({ error: "Bu geçişe izin verilmiyor" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.denemeDegerlendirme.update({
      where: { id },
      data:
        karar === "ONAYLA"
          ? { durum: hedef, onayTarihi: new Date(), onayNotu: not?.trim() || null }
          : { durum: hedef, onayNotu: not!.trim() }, // onayTarihi YAZILMAZ — onaylanmadı
    });
    await tx.denemeDegerlendirmeLog.create({
      data: {
        degerlendirmeId: id,
        eskiDurum: form.durum,
        yeniDurum: hedef,
        aktorId: aktor.userId,
        aciklama: karar === "ONAYLA" ? `Onaylandı${not?.trim() ? `: ${not.trim()}` : ""}` : `Geri gönderildi: ${not!.trim()}`,
      },
    });
  });

  return NextResponse.json({ ok: true, durum: hedef });
}
