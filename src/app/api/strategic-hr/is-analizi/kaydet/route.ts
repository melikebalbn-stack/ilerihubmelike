// src/app/api/strategic-hr/is-analizi/kaydet/route.ts
// POST → İş analizi formunu kaydet (8 bölüm tek seferde, nested create)
//
// Auth + erişim: iaRolCozumle (çalışan; oturumu olan herkes kendi formunu doldurur).
//
// personelId = User.personnelId (Personnel.id). Üst katmanlar (norm kadro,
// polivalans, görev tanımı) iş analizini personele bağlar.
//
// AMİR: İSTEMCİDEN GELMEZ. amirCozumle() ile SUNUCUDA çözülür (TEK KAYNAK).
//   guvenilir=false ise amirPersonnelId ATANMAZ ve form AMIR_ONAYINDA yerine
//   doğrudan IK_INCELEMESINDE'ye gider (sessizce yanlış amire düşmesin).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle } from "@/lib/is-analizi/ia-yetki";
import { amirCozumle } from "@/lib/is-analizi/amir-cozumle";

export async function POST(req: NextRequest) {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;

  // Personel kaydı id'sini al (eşleştirme anahtarı — resolver ile aynı mantık).
  const personnelId = rol.personnelId;
  if (!personnelId) {
    return NextResponse.json(
      { error: "Kullanıcı hesabınız bir personel kaydına bağlı değil." },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "İstek gövdesi okunamadı." }, { status: 400 });
  }

  // pozisyonId ZORUNLU (şemada NOT NULL + IaPozisyon FK). Referans pozisyonu
  // çözemediyse null/boş gelir → pozisyonsuz kayıt imkânsız; çıplak 500 yerine 400.
  if (!body.pozisyonId || typeof body.pozisyonId !== "string") {
    return NextResponse.json(
      {
        error:
          "Pozisyonunuz henüz sistemde tanımlanmadığı için form kaydedilemez. İnsan Varlıkları ile iletişime geçin.",
      },
      { status: 400 }
    );
  }

  try {
    const pozisyon = await prisma.iaPozisyon.findUnique({
      where: { id: body.pozisyonId },
    });
    if (!pozisyon) {
      return NextResponse.json(
        { error: "Seçilen pozisyon sistemde bulunamadı. İnsan Varlıkları ile iletişime geçin." },
        { status: 400 }
      );
    }

    // body.oncekiVersiyonId varsa → revizyon
    let versiyon = 1;
    let oncekiVersiyonId: string | null = null;
    if (body.oncekiVersiyonId) {
      const onceki = await prisma.iaIsAnalizi.findUnique({
        where: { id: body.oncekiVersiyonId },
        select: { id: true, personelId: true, durum: true, versiyon: true },
      });
      // Kayıt sahibi kontrolü (Parça 2) — korunuyor.
      if (!onceki || onceki.personelId !== personnelId) {
        return NextResponse.json({ error: "Geçersiz önceki versiyon." }, { status: 403 });
      }
      if (onceki.durum !== "REVIZE_ISTENDI") {
        return NextResponse.json({ error: "Bu form revizyon durumunda değil." }, { status: 409 });
      }
      // Dallanma önle: bu önceki versiyondan zaten revizyon var mı?
      const zatenRevize = await prisma.iaIsAnalizi.findFirst({
        where: { oncekiVersiyonId: onceki.id },
        select: { id: true },
      });
      if (zatenRevize) {
        return NextResponse.json({ error: "Bu formun zaten bir revizyonu var." }, { status: 409 });
      }
      versiyon = onceki.versiyon + 1;
      oncekiVersiyonId = onceki.id;
    }

    // Amir SUNUCUDA çözülür (istemcinin gönderdiği amir/amirPersonnelId yok sayılır).
    // guvensiz → amirPersonnelId=null ve gönderimde doğrudan İK'ya.
    const amirSonuc = await amirCozumle(personnelId);
    const amirPersonnelId = amirSonuc.guvenilir ? amirSonuc.amirPersonnelId : null;
    const gonderimDurumu = amirSonuc.guvenilir ? "AMIR_ONAYINDA" : "IK_INCELEMESINDE";

    const analiz = await prisma.iaIsAnalizi.create({
      data: {
        personelId: personnelId, // ← User.personnelId (Personnel.id)
        sicilNo: body.sicilNo ?? "",
        adSoyad: body.adSoyad ?? "",
        pozisyonId: body.pozisyonId,
        bolum: pozisyon.bolum,
        amir: amirSonuc.amirAd ?? null,
        amirPersonnelId,
        versiyon,
        oncekiVersiyonId,
        yaka: pozisyon.yaka,
        durum: body.gonder ? gonderimDurumu : "TASLAK",
        zorlukKonusu: body.zorlukKonusu ?? null,
        iyilestirmeOneri: body.iyilestirmeOneri ?? null,
        yapilanIsler: {
          create: (body.yapilanIsler ?? []).map((is: any, i: number) => ({
            isAdi: is.isAdi,
            tetikleyici: is.tetikleyici ?? null,
            makineArac: is.makineArac ?? null,
            siklik: is.siklik,
            sureDakika: is.sureDakika ?? null,
            zamanYuzde: is.zamanYuzde ?? null,
            sira: i,
          })),
        },
        yetkinlikler: {
          create: (body.yetkinlikler ?? []).map((y: any) => ({
            yetkinlikId: y.yetkinlikId,
            mevcutSeviye: y.mevcutSeviye ?? null,
            hedefSeviye: y.hedefSeviye ?? null,
          })),
        },
        kararYetkileri: {
          create: (body.kararYetkileri ?? []).map((k: any) => ({
            konu: k.konu,
            yetkiTipi: k.yetkiTipi,
          })),
        },
        isIliskileri: {
          create: (body.isIliskileri ?? []).map((il: any) => ({
            tip: il.tip,
            taraf: il.taraf,
            aciklama: il.aciklama ?? null,
          })),
        },
        esneklikler: {
          create: (body.esneklikler ?? []).map((e: any) => ({
            tip: e.tip,
            kisiPozIs: e.kisiPozIs,
          })),
        },
      },
      select: { id: true, durum: true },
    });

    return NextResponse.json(analiz, { status: 201 });
  } catch (err) {
    console.error("[is-analizi/kaydet] hata:", err);
    return NextResponse.json(
      { error: "Form kaydedilirken bir hata oluştu. Sorun sürerse İnsan Varlıkları ile iletişime geçin." },
      { status: 500 }
    );
  }
}
