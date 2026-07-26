// GET /api/strategic-hr/is-analizi/onay/detay?id=...
// Bir iş analizi formunun tüm bölümlerini (salt okunur) döner.
// Yetki: yalnız formun amiri (amirPersonnelId = login personnelId).
//
// NOT: IaAnalizYetkinlik'te 'yetkinlik' relation'ı YOK (yetkinlikId düz string).
// Bu yüzden yetkinlik adları AYRI sorguyla çekilip bellekte eşleştirilir.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle, iaYetkisiz } from "@/lib/is-analizi/ia-yetki";


export async function GET(req: NextRequest) {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;
  if (!rol.amir) return iaYetkisiz();

  const personnelId = rol.personnelId;
  if (!personnelId) {
    return NextResponse.json({ error: "Personel kaydınız bulunamadı." }, { status: 404 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Form id gerekli." }, { status: 400 });
  }

  try {
    const form = await prisma.iaIsAnalizi.findUnique({
      where: { id },
      select: {
        id: true,
        adSoyad: true,
        sicilNo: true,
        bolum: true,
        yaka: true,
        amir: true,
        amirPersonnelId: true,
        durum: true,
        zorlukKonusu: true,
        iyilestirmeOneri: true,
        amirNotu: true,
        createdAt: true,
        pozisyon: { select: { ad: true } },
        yapilanIsler: {
          orderBy: { sira: "asc" },
          select: { isAdi: true, tetikleyici: true, makineArac: true, siklik: true, zamanYuzde: true },
        },
        // yetkinlik relation YOK → sadece skalar alanlar + yetkinlikId
        yetkinlikler: {
          select: { yetkinlikId: true, mevcutSeviye: true, hedefSeviye: true },
        },
        kararYetkileri: { select: { konu: true, yetkiTipi: true } },
        isIliskileri: { select: { tip: true, taraf: true, aciklama: true } },
        esneklikler: { select: { tip: true, kisiPozIs: true } },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "Form bulunamadı." }, { status: 404 });
    }
    if (form.amirPersonnelId !== personnelId) {
      return NextResponse.json({ error: "Bu formu görme yetkiniz yok." }, { status: 403 });
    }

    // Yetkinlik adlarını ayrı sorguyla çek ve eşleştir.
    const yetkinlikIdler = form.yetkinlikler.map((y) => y.yetkinlikId);
    let yetkinlikAdMap: Record<string, { ad: string; tip: string | null; grup: string | null }> = {};
    if (yetkinlikIdler.length > 0) {
      const yetler = await prisma.iaYetkinlik.findMany({
        where: { id: { in: yetkinlikIdler } },
        select: { id: true, ad: true, tip: true, grup: true },
      });
      yetkinlikAdMap = Object.fromEntries(
        yetler.map((y) => [y.id, { ad: y.ad, tip: y.tip ?? null, grup: y.grup ?? null }])
      );
    }

    const yetkinlikler = form.yetkinlikler.map((y) => ({
      yetkinlikId: y.yetkinlikId,
      mevcutSeviye: y.mevcutSeviye,
      hedefSeviye: y.hedefSeviye,
      yetkinlik: yetkinlikAdMap[y.yetkinlikId] ?? { ad: "(bilinmeyen)", tip: null, grup: null },
    }));

    return NextResponse.json({ form: { ...form, yetkinlikler } });
  } catch (err) {
    console.error("[onay/detay] hata:", err);
    return NextResponse.json({ error: "Detay alınamadı." }, { status: 500 });
  }
}
