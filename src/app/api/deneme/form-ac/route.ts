// POST /api/deneme/form-ac — cron ve İV kullanır.
// Zinciri çözer, formu açar. Zincir çözülemezse 400 + sebep (FAIL-CLOSED).
// @@unique([personnelId, tur]) çift açmayı zaten engelliyor; mevcut varsa 200 + mevcut.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { denemeZinciriCoz } from "@/lib/deneme/deneme-zincir";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { ikMi, denemeRedLog } from "@/lib/deneme/deneme-yetki";

export const dynamic = "force-dynamic";

const govde = z.object({
  personnelId: z.string().min(1),
  tur: z.enum(["DENEME_2AY", "ALTI_AY"]),
});

export async function POST(request: NextRequest) {
  // Cron bypass — check-evaluations ucundaki desenin aynısı.
  const cronSecret = request.headers.get("x-cron-secret");
  const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET;

  let aktorEmail: string | null = "(cron)";
  let aktorUserId: string | null = null;

  if (!isCron) {
    const { aktor, error } = await aktoruCoz();
    if (error) return error;
    if (!ikMi(aktor)) {
      denemeRedLog({ uc: "form-ac", formId: "(yok)", from: "-", to: "TASLAK", reason: "İV yetkisi yok", user: aktor.email });
      return NextResponse.json({ error: "Bu işlem için İnsan Varlıkları yetkisi gerekir" }, { status: 403 });
    }
    aktorEmail = aktor.email ?? null;
    aktorUserId = aktor.userId;
  }

  const parsed = govde.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    denemeRedLog({ uc: "form-ac", formId: "(yok)", from: "-", to: "TASLAK", reason: "gövde şeması geçersiz", user: aktorEmail });
    return NextResponse.json({ error: "Geçersiz istek gövdesi", detay: parsed.error.flatten() }, { status: 400 });
  }
  const { personnelId, tur } = parsed.data;

  const mevcut = await prisma.denemeDegerlendirme.findUnique({
    where: { personnelId_tur: { personnelId, tur } },
    select: { id: true, durum: true, tur: true, hedefTarih: true },
  });
  if (mevcut) return NextResponse.json({ olusturuldu: false, form: mevcut }, { status: 200 });

  const kisi = await prisma.personnel.findUnique({
    where: { id: personnelId },
    select: { denemeDegerlendirme: true, altiAyDegerlendirme: true, yakaRengi: true },
  });
  if (!kisi) {
    denemeRedLog({ uc: "form-ac", formId: "(yok)", from: "-", to: "TASLAK", reason: "personel yok", user: aktorEmail });
    return NextResponse.json({ error: "Personel kaydı bulunamadı" }, { status: 400 });
  }

  const hedefTarih = tur === "DENEME_2AY" ? kisi.denemeDegerlendirme : kisi.altiAyDegerlendirme;
  if (!hedefTarih) {
    denemeRedLog({ uc: "form-ac", formId: "(yok)", from: "-", to: "TASLAK", reason: "hedef tarih boş", user: aktorEmail });
    return NextResponse.json({ error: "Personelin bu tür için değerlendirme tarihi yok" }, { status: 400 });
  }

  // GEÇMİŞ TARİH İÇİN FORM AÇILMAZ (Melih kararı) — yalnız bugün ve sonrası.
  const bugun = new Date();
  bugun.setUTCHours(0, 0, 0, 0);
  if (hedefTarih < bugun) {
    denemeRedLog({ uc: "form-ac", formId: "(yok)", from: "-", to: "TASLAK", reason: "hedef tarih geçmiş", user: aktorEmail });
    return NextResponse.json({ error: "Değerlendirme tarihi geçmiş — geçmiş tarihler için form açılmaz" }, { status: 400 });
  }

  const zincir = await denemeZinciriCoz(prisma, personnelId);
  if (!zincir.ok) {
    denemeRedLog({ uc: "form-ac", formId: "(yok)", from: "-", to: "TASLAK", reason: zincir.sebep, user: aktorEmail });
    return NextResponse.json({ error: "Değerlendirme zinciri çözülemedi", sebep: zincir.sebep }, { status: 400 });
  }

  // Kriter revizyonu SNAPSHOT — form ömrü boyunca sabit.
  const aktifKriter = await prisma.denemeKriter.findFirst({
    where: { aktif: true },
    orderBy: [{ revizyon: "desc" }, { sira: "asc" }],
    select: { revizyon: true },
  });
  if (!aktifKriter) {
    return NextResponse.json({ error: "Kriter kataloğu boş — seed çalıştırılmamış" }, { status: 500 });
  }

  const form = await prisma.$transaction(async (tx) => {
    const f = await tx.denemeDegerlendirme.create({
      data: {
        personnelId,
        tur,
        hedefTarih,
        yakaRengi: zincir.yakaRengi,
        kriterRevizyon: aktifKriter.revizyon,
        durum: zincir.baslangicDurumu,
        degerlendirici1Id: zincir.degerlendirici1.personnelId,
        degerlendirici1Rol: zincir.degerlendirici1.rol,
        degerlendirici2Id: zincir.degerlendirici2?.personnelId ?? null,
        degerlendirici2Rol: zincir.degerlendirici2?.rol ?? null,
        onaylayanId: zincir.onaylayan?.personnelId ?? null,
        createdBy: aktorUserId ?? "(cron)",
      },
      select: { id: true, durum: true, tur: true, hedefTarih: true },
    });
    await tx.denemeDegerlendirmeLog.create({
      data: {
        degerlendirmeId: f.id,
        eskiDurum: null,
        yeniDurum: zincir.baslangicDurumu,
        aktorId: aktorUserId,
        aciklama: `Form açıldı (${zincir.departmentAdi}, ${zincir.yakaRengi})${zincir.atlananlar.length ? " · " + zincir.atlananlar.join(" · ") : ""}`,
      },
    });
    return f;
  });

  return NextResponse.json({ olusturuldu: true, form, zincir: { atlananlar: zincir.atlananlar } }, { status: 201 });
}
