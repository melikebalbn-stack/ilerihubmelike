// GET /api/strategic-hr/is-analizi/ik/detay?id=...
// Bir formun tüm bölümleri (salt okunur). Erişim: İK yetkisi (rol).
// NOT: IaAnalizYetkinlik'te yetkinlik relation'ı yok → adlar ayrı çekilir.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle, iaYetkisiz } from "@/lib/is-analizi/ia-yetki";


export async function GET(req: NextRequest) {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;

  if (!rol.ik) return iaYetkisiz();

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
        versiyon: true,
        durum: true,
        zorlukKonusu: true,
        iyilestirmeOneri: true,
        amirNotu: true,
        ikNotu: true,
        createdAt: true,
        pozisyon: { select: { ad: true } },
        yapilanIsler: {
          orderBy: { sira: "asc" },
          select: { isAdi: true, tetikleyici: true, makineArac: true, siklik: true, zamanYuzde: true },
        },
        yetkinlikler: { select: { yetkinlikId: true, mevcutSeviye: true, hedefSeviye: true } },
        kararYetkileri: { select: { konu: true, yetkiTipi: true } },
        isIliskileri: { select: { tip: true, taraf: true, aciklama: true } },
        esneklikler: { select: { tip: true, kisiPozIs: true } },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "Form bulunamadı." }, { status: 404 });
    }
    if (form.durum !== "IK_INCELEMESINDE") {
      return NextResponse.json({ error: "Bu form İK incelemesinde değil." }, { status: 409 });
    }

    // Yetkinlik adları ayrı çekilir
    const yetkinlikIdler = form.yetkinlikler.map((y) => y.yetkinlikId);
    let map: Record<string, { ad: string; tip: string | null; grup: string | null }> = {};
    if (yetkinlikIdler.length > 0) {
      const yetler = await prisma.iaYetkinlik.findMany({
        where: { id: { in: yetkinlikIdler } },
        select: { id: true, ad: true, tip: true, grup: true },
      });
      map = Object.fromEntries(yetler.map((y) => [y.id, { ad: y.ad, tip: y.tip ?? null, grup: y.grup ?? null }]));
    }
    const yetkinlikler = form.yetkinlikler.map((y) => ({
      yetkinlikId: y.yetkinlikId,
      mevcutSeviye: y.mevcutSeviye,
      hedefSeviye: y.hedefSeviye,
      yetkinlik: map[y.yetkinlikId] ?? { ad: "(bilinmeyen)", tip: null, grup: null },
    }));

    return NextResponse.json({ form: { ...form, yetkinlikler } });
  } catch (err) {
    console.error("[ik/detay] hata:", err);
    return NextResponse.json({ error: "Detay alınamadı." }, { status: 500 });
  }
}
