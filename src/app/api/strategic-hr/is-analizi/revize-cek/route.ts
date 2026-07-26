// GET /api/strategic-hr/is-analizi/revize-cek?id=...
// REVIZE_ISTENDI durumundaki bir formun TÜM verilerini döner ki
// wizard revizyon modunda dolu açılabilsin.
//
// Yetki: yalnız formun sahibi (personelId = login personnelId).
// Ön koşul: durum = REVIZE_ISTENDI ve bu formun zaten bir revizyonu yok.
//
// Çıktı, wizard'ın kullandığı yapıya uygun döner (isler, yetSeviye vb.).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle } from "@/lib/is-analizi/ia-yetki";


export async function GET(req: NextRequest) {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;

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
        personelId: true,
        durum: true,
        amirNotu: true,
        zorlukKonusu: true,
        iyilestirmeOneri: true,
        yapilanIsler: {
          orderBy: { sira: "asc" },
          select: { isAdi: true, tetikleyici: true, makineArac: true, siklik: true, zamanYuzde: true },
        },
        yetkinlikler: { select: { yetkinlikId: true, mevcutSeviye: true } },
        kararYetkileri: { select: { konu: true, yetkiTipi: true } },
        isIliskileri: { select: { tip: true, taraf: true } },
        esneklikler: { select: { kisiPozIs: true } },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "Form bulunamadı." }, { status: 404 });
    }
    if (form.personelId !== personnelId) {
      return NextResponse.json({ error: "Bu forma erişim yetkiniz yok." }, { status: 403 });
    }
    if (form.durum !== "REVIZE_ISTENDI") {
      return NextResponse.json({ error: "Bu form revizyon durumunda değil." }, { status: 409 });
    }
    // Zaten revizyonu var mı?
    const zaten = await prisma.iaIsAnalizi.findFirst({
      where: { oncekiVersiyonId: form.id },
      select: { id: true },
    });
    if (zaten) {
      return NextResponse.json({ error: "Bu formun zaten bir revizyonu var." }, { status: 409 });
    }

    // Wizard'ın beklediği şekle dönüştür
    const isler = form.yapilanIsler.map((is) => ({
      isAdi: is.isAdi,
      tetikleyici: is.tetikleyici ?? "",
      makineArac: is.makineArac ?? "",
      siklik: is.siklik,
      zamanYuzde: is.zamanYuzde ?? 0,
    }));
    const yetSeviye: Record<string, string> = {};
    for (const y of form.yetkinlikler) {
      yetSeviye[y.yetkinlikId] = String(y.mevcutSeviye ?? 3);
    }
    const kararlar = form.kararYetkileri.map((k) => ({ konu: k.konu, yetkiTipi: k.yetkiTipi }));
    const iliskiler = form.isIliskileri.map((il) => ({ tip: il.tip, taraf: il.taraf }));
    const esneklikler = form.esneklikler.map((e) => e.kisiPozIs);

    return NextResponse.json({
      oncekiVersiyonId: form.id,
      amirNotu: form.amirNotu,
      veri: {
        isler,
        yetSeviye,
        kararlar: kararlar.length ? kararlar : [{ konu: "", yetkiTipi: "TEK_BASINA" }],
        iliskiler: iliskiler.length ? iliskiler : [{ tip: "RAPORLAR", taraf: "" }],
        esneklikler: esneklikler.length ? esneklikler : [""],
        zorluk: form.zorlukKonusu ?? "",
        oneri: form.iyilestirmeOneri ?? "",
      },
    });
  } catch (err) {
    console.error("[revize-cek] hata:", err);
    return NextResponse.json({ error: "Veri alınamadı." }, { status: 500 });
  }
}
