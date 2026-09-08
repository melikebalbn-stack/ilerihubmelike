// GET /api/deneme — liste. YALNIZ İV.
//
// Liste puanları, ortalamayı ve başarılı/başarısız sonucunu döndürüyor; bu bilgi
// İnsan Varlıkları'na aittir. Zincirdeki müdürler burayı GÖRMEZ (403) — onlar
// maildeki /deneme/<id> bağlantısıyla yalnız KENDİ formlarını açar; form ekranının
// görünürlük kuralı (zincirdekiler + İV) DEĞİŞMEDİ.
//
// Personel kartındaki "Deneme Değerlendirme" bölümü de bu ucu çağırıyor
// (?personnelId=…) — dolayısıyla o bölüm de yalnız İV'de görünür hâle gelir
// (403 → bileşen boş liste sayar → kart hiç çizilmez).
//
// Filtreler: durum, tur, yaka, bolum, personnelId, tarih aralığı, hepsi.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { ikMi, denemeRedLog } from "@/lib/deneme/deneme-yetki";
import type { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const filtre = z.object({
  durum: z.enum(["TASLAK", "DEGERLENDIRICI1_BEKLIYOR", "MUDUR_YRD_BEKLIYOR", "MUDUR_BEKLIYOR", "ONAY_BEKLIYOR", "IK_BEKLIYOR", "TAMAMLANDI", "IPTAL"]).optional(),
  tur: z.enum(["DENEME_2AY", "ALTI_AY"]).optional(),
  yaka: z.enum(["MAVI", "GRI", "BEYAZ"]).optional(),
  bolum: z.string().optional(),
  personnelId: z.string().optional(),
  baslangic: z.string().optional(),
  bitis: z.string().optional(),
  /** true → kapanmışlar dahil. Varsayılan: yalnız AÇIK formlar. */
  hepsi: z.enum(["true", "false"]).optional(),
});

/** Durumdan o anki adımın sahibinin ADI — liste kolonu için. */
function adimSahibiAdi(f: {
  durum: string
  degerlendirici1: { adSoyad: string } | null
  degerlendirici2: { adSoyad: string } | null
  onaylayan: { adSoyad: string } | null
}): string | null {
  switch (f.durum) {
    case "DEGERLENDIRICI1_BEKLIYOR":
      return f.degerlendirici1?.adSoyad ?? null;
    case "MUDUR_YRD_BEKLIYOR":
    case "MUDUR_BEKLIYOR":
      return f.degerlendirici2?.adSoyad ?? null;
    case "ONAY_BEKLIYOR":
      return f.onaylayan?.adSoyad ?? null;
    case "IK_BEKLIYOR":
      return "İnsan Varlıkları";
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  // İV KAPISI: liste yalnız İnsan Varlıkları'nın. Eski "kendi zincirindekileri
  // görür" kapsamı KALKTI (Melih kararı — sonuçlar İV dışına gösterilmez).
  if (!ikMi(aktor)) {
    denemeRedLog({ uc: "liste", formId: "(liste)", from: "-", to: "-", reason: "İV yetkisi yok", user: aktor.email });
    return NextResponse.json({ error: "Bu listeye erişim yetkiniz yok" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const parsed = filtre.safeParse({
    durum: sp.get("durum") ?? undefined,
    tur: sp.get("tur") ?? undefined,
    yaka: sp.get("yaka") ?? undefined,
    bolum: sp.get("bolum") ?? undefined,
    personnelId: sp.get("personnelId") ?? undefined,
    baslangic: sp.get("baslangic") ?? undefined,
    bitis: sp.get("bitis") ?? undefined,
    hepsi: sp.get("hepsi") ?? undefined,
  });
  if (!parsed.success) {
    denemeRedLog({ uc: "liste", formId: "(liste)", from: "-", to: "-", reason: "filtre geçersiz", user: aktor.email });
    return NextResponse.json({ error: "Geçersiz filtre", detay: parsed.error.flatten() }, { status: 400 });
  }
  const f = parsed.data;

  const where: Prisma.DenemeDegerlendirmeWhereInput = {};
  // Varsayılan kapsam: AÇIK formlar. `durum` verilirse ya da hepsi=true ise kapsam açılır.
  if (!f.durum && f.hepsi !== "true") where.durum = { notIn: ["TAMAMLANDI", "IPTAL"] };
  if (f.durum) where.durum = f.durum;
  if (f.bolum) where.personnel = { bolum: f.bolum };
  if (f.personnelId) where.personnelId = f.personnelId;
  if (f.tur) where.tur = f.tur;
  if (f.yaka) where.yakaRengi = f.yaka;
  if (f.baslangic || f.bitis) {
    where.hedefTarih = {};
    if (f.baslangic) (where.hedefTarih as Prisma.DateTimeFilter).gte = new Date(f.baslangic);
    if (f.bitis) (where.hedefTarih as Prisma.DateTimeFilter).lte = new Date(f.bitis);
  }

  const formlar = await prisma.denemeDegerlendirme.findMany({
    where,
    orderBy: [{ hedefTarih: "asc" }, { id: "asc" }],
    take: 500,
    select: {
      id: true, tur: true, durum: true, hedefTarih: true, yakaRengi: true,
      puan1: true, puan2: true, ortalama: true, basarili: true,
      personnel: { select: { sicilNo: true, adSoyad: true, bolum: true, gorev: true } },
      degerlendirici1: { select: { adSoyad: true } },
      degerlendirici2: { select: { adSoyad: true } },
      onaylayan: { select: { adSoyad: true } },
    },
  });

  const satirlar = formlar.map((x) => ({ ...x, adimSahibi: adimSahibiAdi(x) }));
  return NextResponse.json({ formlar: satirlar, toplam: satirlar.length, kapsam: "tumu" });
}
