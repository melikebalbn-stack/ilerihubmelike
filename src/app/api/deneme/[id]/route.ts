// GET /api/deneme/[id] — form + kriterler + puanlar.
// GİZLİLİK: yalnız zincirdekiler (dolduran, onaylayan) + İV. Başkası 403.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { gorebilirMi, formRolleri, adimSahibiMi, denemeRedLog } from "@/lib/deneme/deneme-yetki";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  const form = await prisma.denemeDegerlendirme.findUnique({
    where: { id },
    include: {
      // Form başlığındaki künye alanları (IV-FR-27 üst bilgi bloğu)
      personnel: {
        select: {
          sicilNo: true, adSoyad: true, bolum: true, bolumDetay: true, gorev: true,
          yakaRengi: true, iseGirisTarihi: true,
          denemeDegerlendirme: true, altiAyDegerlendirme: true,
        },
      },
      degerlendirici1: { select: { sicilNo: true, adSoyad: true, gorev: true } },
      degerlendirici2: { select: { sicilNo: true, adSoyad: true, gorev: true } },
      onaylayan: { select: { sicilNo: true, adSoyad: true, gorev: true } },
      puanlar: { select: { kriterId: true, degerlendiriciSira: true, puan: true, not: true } },
      loglar: { orderBy: { createdAt: "asc" }, select: { eskiDurum: true, yeniDurum: true, aciklama: true, createdAt: true } },
    },
  });
  if (!form) return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 });

  if (!gorebilirMi(form, aktor)) {
    denemeRedLog({ uc: "goruntule", formId: id, from: form.durum, to: "-", reason: "zincirde değil, İV değil", user: aktor.email });
    return NextResponse.json({ error: "Bu formu görüntüleme yetkiniz yok" }, { status: 403 });
  }

  // Kriterler formun KENDİ revizyonundan (snapshot) — sonraki revizyon eski formu bozmasın.
  const kriterler = await prisma.denemeKriter.findMany({
    where: { revizyon: form.kriterRevizyon },
    orderBy: { sira: "asc" },
    select: { id: true, sira: true, grup: true, baslik: true, aciklama: true },
  });

  return NextResponse.json({
    form,
    kriterler,
    yetki: { roller: formRolleri(form, aktor), adimSahibi: adimSahibiMi(form, aktor) },
  });
}
