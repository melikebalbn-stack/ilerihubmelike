// POST /api/deneme/[id]/aktar — müdür yardımcısı formu bölüm müdürüne AKTARIR.
// Yalnız MUDUR_YRD_BEKLIYOR durumunda ve yalnız müdür yardımcısı. Puan VERİLMEZ,
// aktarım sonrası onay adımı YOKTUR (müdür doldurur → doğrudan İK).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { adimSahibiMi, denemeRedLog } from "@/lib/deneme/deneme-yetki";
import { gecisIzinli } from "@/lib/deneme/deneme-transitions";

export const dynamic = "force-dynamic";

const govde = z.object({ aciklama: z.string().max(2000).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  const parsed = govde.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    denemeRedLog({ uc: "aktar", formId: id, from: "(okunmadı)", to: "MUDUR_BEKLIYOR", reason: "gövde şeması geçersiz", user: aktor.email });
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const form = await prisma.denemeDegerlendirme.findUnique({
    where: { id },
    select: { id: true, durum: true, personnelId: true, degerlendirici1Id: true, degerlendirici2Id: true, onaylayanId: true },
  });
  if (!form) return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 });

  if (form.durum !== "MUDUR_YRD_BEKLIYOR") {
    denemeRedLog({ uc: "aktar", formId: id, from: form.durum, to: "MUDUR_BEKLIYOR", reason: "durum aktarıma uygun değil", user: aktor.email });
    return NextResponse.json({ error: "Form bu aşamada aktarılamaz" }, { status: 400 });
  }
  if (!adimSahibiMi(form, aktor)) {
    denemeRedLog({ uc: "aktar", formId: id, from: form.durum, to: "MUDUR_BEKLIYOR", reason: "adım sahibi değil", user: aktor.email });
    return NextResponse.json({ error: "Bu formu aktarma yetkiniz yok" }, { status: 403 });
  }
  if (!gecisIzinli(form.durum, "MUDUR_YARDIMCISI", "MUDUR_BEKLIYOR")) {
    return NextResponse.json({ error: "Bu geçişe izin verilmiyor" }, { status: 400 });
  }

  // Bölüm müdürünü FK'dan yeniden çöz — aktarım anındaki güncel müdür.
  const kisi = await prisma.personnel.findUnique({
    where: { id: form.personnelId },
    select: { department: { select: { name: true, mudurId: true } } },
  });
  const mudurId = kisi?.department?.mudurId ?? null;
  if (!mudurId) {
    denemeRedLog({ uc: "aktar", formId: id, from: form.durum, to: "MUDUR_BEKLIYOR", reason: "bölüm müdürü çözülemedi", user: aktor.email });
    return NextResponse.json({ error: "Bölüm müdürü çözülemedi — İnsan Varlıkları ile iletişime geçin" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.denemeDegerlendirme.update({
      where: { id },
      data: {
        durum: "MUDUR_BEKLIYOR",
        degerlendirici2Id: mudurId,
        degerlendirici2Rol: "MUDUR",
        onaylayanId: null, // müdür doldurunca onay adımı YOK
      },
    });
    await tx.denemeDegerlendirmeLog.create({
      data: {
        degerlendirmeId: id,
        eskiDurum: form.durum,
        yeniDurum: "MUDUR_BEKLIYOR",
        aktorId: aktor.userId,
        aciklama: `Müdür yardımcısı formu bölüm müdürüne aktardı${parsed.data.aciklama ? `: ${parsed.data.aciklama}` : ""}`,
      },
    });
  });

  return NextResponse.json({ ok: true, durum: "MUDUR_BEKLIYOR" });
}
