// POST /api/deneme/[id]/kapat — İK aşaması, İV kapatır.
// ortalama < 60 ise fesihGerekce ZORUNLU (boşsa 400).
// Otomatik fesih/offboarding TETİKLEMEZ — yalnız kayıt tutulur (Melih kararı).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { ikMi, denemeRedLog } from "@/lib/deneme/deneme-yetki";
import { gecisIzinli, DENEME_GECME_PUANI, denemeBasariliMi } from "@/lib/deneme/deneme-transitions";

export const dynamic = "force-dynamic";

const govde = z.object({
  /** KAPAT → TAMAMLANDI · IPTAL → IPTAL (gerekçe zorunlu). Varsayılan KAPAT. */
  karar: z.enum(["KAPAT", "IPTAL"]).default("KAPAT"),
  fesihGerekce: z.string().max(4000).optional(),
  not: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  if (!ikMi(aktor)) {
    denemeRedLog({ uc: "kapat", formId: id, from: "(okunmadı)", to: "TAMAMLANDI", reason: "İV yetkisi yok", user: aktor.email });
    return NextResponse.json({ error: "Bu işlem için İnsan Varlıkları yetkisi gerekir" }, { status: 403 });
  }

  const parsed = govde.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    denemeRedLog({ uc: "kapat", formId: id, from: "(okunmadı)", to: "TAMAMLANDI", reason: "gövde şeması geçersiz", user: aktor.email });
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const form = await prisma.denemeDegerlendirme.findUnique({
    where: { id },
    select: { id: true, durum: true, ortalama: true, puan1: true, puan2: true },
  });
  if (!form) return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 });

  const karar = parsed.data.karar;

  // ── İPTAL: HER AŞAMADA ──
  // Geçiş matrisi (deneme-transitions.ts) İV'ye her durumdan IPTAL izni veriyor;
  // uç bunu uygulamıyordu çünkü IK_BEKLIYOR kontrolü bu dalın ÖNÜNDEYDİ. Kontrol
  // artık YALNIZ kapatma dalında. Terminal durumlar (TAMAMLANDI/IPTAL) matriste
  // boş satır olduğu için gecisIzinli false döner → 400.
  if (karar === "IPTAL") {
    if (!gecisIzinli(form.durum, "IK", "IPTAL")) {
      denemeRedLog({ uc: "kapat", formId: id, from: form.durum, to: "IPTAL", reason: "gecis matriste izinli degil", user: aktor.email });
      return NextResponse.json({ error: "Bu formda iptal işlemi yapılamaz" }, { status: 400 });
    }
    // Gerekçe ZORUNLU, puan/sonuç aranmaz (form yarıda kesiliyor).
    const gerekceIptal = parsed.data.fesihGerekce?.trim() ?? "";
    if (!gerekceIptal) {
      denemeRedLog({ uc: "kapat", formId: id, from: form.durum, to: "IPTAL", reason: "iptal gerekcesi bos", user: aktor.email });
      return NextResponse.json({ error: "İptal için gerekçe zorunludur" }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.denemeDegerlendirme.update({
        where: { id },
        data: { durum: "IPTAL", fesihGerekce: gerekceIptal, ikKapatanId: aktor.userId, ikKapatmaTarihi: new Date() },
      });
      await tx.denemeDegerlendirmeLog.create({
        data: {
          degerlendirmeId: id, eskiDurum: form.durum, yeniDurum: "IPTAL",
          aktorId: aktor.userId, aciklama: `İV iptal etti: ${gerekceIptal}`,
        },
      });
    });
    return NextResponse.json({ ok: true, durum: "IPTAL" });
  }

  // ── KAPAT: YALNIZ İK aşamasında ──
  if (form.durum !== "IK_BEKLIYOR") {
    denemeRedLog({ uc: "kapat", formId: id, from: form.durum, to: "TAMAMLANDI", reason: "durum kapanışa uygun değil", user: aktor.email });
    return NextResponse.json({ error: "Form İK aşamasında değil" }, { status: 400 });
  }
  const ort = form.ortalama;
  if (ort === null) {
    denemeRedLog({ uc: "kapat", formId: id, from: form.durum, to: "TAMAMLANDI", reason: "puan yok", user: aktor.email });
    return NextResponse.json({ error: "Formda puan yok — kapatılamaz" }, { status: 400 });
  }

  const gerekce = parsed.data.fesihGerekce?.trim() ?? "";
  if (ort < DENEME_GECME_PUANI && !gerekce) {
    denemeRedLog({ uc: "kapat", formId: id, from: form.durum, to: "TAMAMLANDI", reason: `ortalama ${ort} < ${DENEME_GECME_PUANI}, gerekçe boş`, user: aktor.email });
    return NextResponse.json(
      { error: `Ortalama ${DENEME_GECME_PUANI} altında (${ort}) — gerekçeli tutanak zorunludur` },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.denemeDegerlendirme.update({
      where: { id },
      data: {
        durum: "TAMAMLANDI",
        basarili: denemeBasariliMi(ort),
        fesihGerekce: gerekce || null,
        ikKapatanId: aktor.userId,
        ikKapatmaTarihi: new Date(),
      },
    });
    await tx.denemeDegerlendirmeLog.create({
      data: {
        degerlendirmeId: id,
        eskiDurum: form.durum,
        yeniDurum: "TAMAMLANDI",
        aktorId: aktor.userId,
        aciklama: `İV kapattı — ortalama ${ort}, sonuç ${ort >= DENEME_GECME_PUANI ? "BAŞARILI" : "BAŞARISIZ"}${parsed.data.not?.trim() ? `: ${parsed.data.not.trim()}` : ""}`,
      },
    });
  });

  return NextResponse.json({ ok: true, durum: "TAMAMLANDI", ortalama: ort, basarili: ort >= DENEME_GECME_PUANI });
}
