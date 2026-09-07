// POST /api/deneme/[id]/puanla — 20 kriterin puanı (1-5).
// Kısmi kayıt (taslak) desteklenir; `gonder: true` gelirse geçiş matrisine göre
// bir sonraki duruma taşınır. Yetki: o anki ADIMIN SAHİBİ mi.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { adimSahibiMi, adimSahibiRol, denemeRedLog } from "@/lib/deneme/deneme-yetki";
import { gecisIzinli, denemeOrtalama, denemeBasariliMi } from "@/lib/deneme/deneme-transitions";
import type { DenemeDurum } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const govde = z.object({
  puanlar: z.array(z.object({ kriterId: z.string().min(1), puan: z.number().int().min(1).max(5), not: z.string().max(2000).optional() })).min(1),
  gonder: z.boolean().default(false),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  const parsed = govde.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    denemeRedLog({ uc: "puanla", formId: id, from: "(okunmadı)", to: "-", reason: "gövde şeması geçersiz", user: aktor.email });
    return NextResponse.json({ error: "Geçersiz istek gövdesi", detay: parsed.error.flatten() }, { status: 400 });
  }
  const { puanlar, gonder } = parsed.data;

  const form = await prisma.denemeDegerlendirme.findUnique({
    where: { id },
    select: {
      id: true, durum: true, personnelId: true, kriterRevizyon: true, yakaRengi: true,
      degerlendirici1Id: true, degerlendirici2Id: true, onaylayanId: true,
      degerlendirici2Rol: true, puan1: true, puan2: true,
    },
  });
  if (!form) return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 });

  if (!adimSahibiMi(form, aktor)) {
    denemeRedLog({ uc: "puanla", formId: id, from: form.durum, to: "-", reason: "adım sahibi değil", user: aktor.email });
    return NextResponse.json({ error: "Bu aşamada puanlama yetkiniz yok" }, { status: 403 });
  }
  const rol = adimSahibiRol(form.durum);
  if (rol === "ONAYLAYAN" || rol === "IK" || rol === null) {
    denemeRedLog({ uc: "puanla", formId: id, from: form.durum, to: "-", reason: "bu aşamada puan girilmez", user: aktor.email });
    return NextResponse.json({ error: "Bu aşamada puan girilmez" }, { status: 400 });
  }

  const sira = form.durum === "DEGERLENDIRICI1_BEKLIYOR" ? 1 : 2;

  // Kriterler formun KENDİ revizyonundan — başka revizyonun kriteri kabul edilmez.
  const gecerli = await prisma.denemeKriter.findMany({
    where: { revizyon: form.kriterRevizyon },
    select: { id: true },
  });
  const gecerliSet = new Set(gecerli.map((k) => k.id));
  const kacak = puanlar.filter((p) => !gecerliSet.has(p.kriterId));
  if (kacak.length) {
    denemeRedLog({ uc: "puanla", formId: id, from: form.durum, to: "-", reason: `formun revizyonunda olmayan kriter (${kacak.length})`, user: aktor.email });
    return NextResponse.json({ error: "Formun revizyonunda olmayan kriter gönderildi" }, { status: 400 });
  }

  // GÖNDER için 20 kriterin TAMAMI dolu olmalı; taslakta kısmi serbest.
  if (gonder && puanlar.length !== gecerli.length) {
    denemeRedLog({ uc: "puanla", formId: id, from: form.durum, to: "-", reason: `eksik kriter: ${puanlar.length}/${gecerli.length}`, user: aktor.email });
    return NextResponse.json({ error: `Gönderim için ${gecerli.length} kriterin tamamı doldurulmalı (${puanlar.length} geldi)` }, { status: 400 });
  }

  // Hedef durum: 1. adım sonrası zincirden, 2. adım sonrası sabit.
  let hedef: DenemeDurum | null = null;
  if (gonder) {
    if (sira === 1) {
      if (form.yakaRengi === "MAVI") {
        hedef = form.degerlendirici2Rol === "MUDUR_YARDIMCISI" ? "MUDUR_YRD_BEKLIYOR" : "MUDUR_BEKLIYOR";
      } else {
        hedef = form.onaylayanId ? "ONAY_BEKLIYOR" : "IK_BEKLIYOR";
      }
    } else {
      // 2. puan: müdür yrd. doldurduysa müdür onayına, müdür doldurduysa doğrudan İK.
      hedef = form.durum === "MUDUR_YRD_BEKLIYOR" ? "ONAY_BEKLIYOR" : "IK_BEKLIYOR";
    }
    if (!gecisIzinli(form.durum, rol, hedef)) {
      denemeRedLog({ uc: "puanla", formId: id, from: form.durum, to: hedef, reason: "geçiş matriste izinli değil", user: aktor.email });
      return NextResponse.json({ error: "Bu geçişe izin verilmiyor" }, { status: 400 });
    }
  }

  const sonuc = await prisma.$transaction(async (tx) => {
    for (const p of puanlar) {
      await tx.denemePuan.upsert({
        where: { degerlendirmeId_kriterId_degerlendiriciSira: { degerlendirmeId: id, kriterId: p.kriterId, degerlendiriciSira: sira } },
        update: { puan: p.puan, not: p.not ?? null },
        create: { degerlendirmeId: id, kriterId: p.kriterId, degerlendiriciSira: sira, puan: p.puan, not: p.not ?? null },
      });
    }

    if (!gonder) return { durum: form.durum, hamToplam: null as number | null };

    // Ham toplam = 20 kriter × 1-5 → 20..100. Ekstra dönüşüm YOK.
    const agg = await tx.denemePuan.aggregate({
      where: { degerlendirmeId: id, degerlendiriciSira: sira },
      _sum: { puan: true },
    });
    const hamToplam = agg._sum.puan ?? 0;
    const puan1 = sira === 1 ? hamToplam : form.puan1;
    const puan2 = sira === 2 ? hamToplam : form.puan2;
    const ort = denemeOrtalama(puan1 ?? null, puan2 ?? null);

    await tx.denemeDegerlendirme.update({
      where: { id },
      data: {
        durum: hedef!,
        ...(sira === 1 ? { puan1: hamToplam, degerlendirici1At: new Date() } : { puan2: hamToplam, degerlendirici2At: new Date() }),
        ortalama: ort,
        basarili: denemeBasariliMi(ort),
      },
    });
    await tx.denemeDegerlendirmeLog.create({
      data: {
        degerlendirmeId: id,
        eskiDurum: form.durum,
        yeniDurum: hedef!,
        aktorId: aktor.userId,
        aciklama: `${sira}. değerlendirici puanladı (ham toplam ${hamToplam})`,
      },
    });
    return { durum: hedef!, hamToplam };
  });

  return NextResponse.json({ ok: true, kaydedilen: puanlar.length, gonderildi: gonder, ...sonuc });
}
