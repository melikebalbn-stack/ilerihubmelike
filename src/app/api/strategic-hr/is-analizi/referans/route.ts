// ═══════════════════════════════════════════════════════════════════════
//  GET /api/strategic-hr/is-analizi/referans
//  İş Analizi Formu — Referans Çözümleyici (resolver) — v3
//
//  Form (IsAnaliziWizard v5) sözleşmesi:
//    { personel:{sicilNo,adSoyad,bolum,gorev,yaka,amir},
//      amirPersonnelId,           ← YENİ: onay akışı için amir hesabı
//      pozisyonId, pozisyonBulundu,
//      makineler: string[],
//      yetkinlikler: [{yetkinlikId,ad,grup,tip,hedefSeviye}] }
//
//  EŞLEŞTİRME: Login → User.personnelId → OrgEmployee.personnelId (pozisyon/bölüm)
//  AMİR: Personnel.birimSorumlusu (isim) → o isimle Personnel.id (amirPersonnelId)
//        (Org'da amir bağı boş; Personnel'de "1. Sorumlu" = birimSorumlusu dolu.)
//  ÇOKLU KOLTUK: parent zinciri DEPARTMENT'e çıkan, en düşük level = birincil.
//
//  Kurallar: @/lib/prisma; ia_ dışı tablolar salt okunur.
//  KVKK: Personnel'den yalnız sicilNo, adSoyad, gorev, bolum, yakaRengi,
//        birimSorumlusu seçilir. Hassas alanlara (TC, kan grubu, adres, mail,
//        telefon, banka, servis, exit*) DOKUNULMAZ.
// ═══════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle } from "@/lib/is-analizi/ia-yetki";
import { amirCozumle } from "@/lib/is-analizi/amir-cozumle";
import { birincilKoltukBul } from "@/lib/is-analizi/birincil-koltuk";


function normalizeAd(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/_x000D_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

export async function GET() {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;

  try {
    // personnelId (eşleştirme anahtarı)
    const personnelId = rol.personnelId;
    if (!personnelId) {
      return NextResponse.json(
        { error: "Kullanıcı hesabınız bir personel kaydına bağlı değil. İnsan Varlıkları ile iletişime geçin." },
        { status: 404 }
      );
    }

    // Birincil koltuk (ana pozisyon) — kurul eleme dahil TEK KAYNAK helper.
    const koltuk = await birincilKoltukBul(personnelId);
    if (!koltuk) {
      // Ya hiç koltuk yok ya da yalnız kurul koltuğu var → ana pozisyon çözülemez.
      return NextResponse.json(
        {
          error:
            "Ana pozisyonunuz organizasyon şemasından belirlenemedi (yalnız kurul/komite üyeliğiniz olabilir). İnsan Varlıkları ile iletişime geçin.",
        },
        { status: 404 }
      );
    }
    const birincil = koltuk.secilen;
    const pozisyonAd = birincil.orgUnitAd;
    const bolum = { ad: birincil.departmanAd, orgUnitId: birincil.departmanOrgUnitId };

    // Personel: KVKK-güvenli alanlar + amir (birimSorumlusu)
    const p = await prisma.personnel.findUnique({
      where: { id: personnelId },
      select: {
        sicilNo: true,
        adSoyad: true,
        gorev: true,
        bolum: true,
        yakaRengi: true,
        birimSorumlusu: true, // "1. Sorumlu" = birinci amir (isim)
      },
    });

    // Amir: ORG ağacı önce, isim fallback — amir-cozumle TEK KAYNAK (Parça 1).
    // guvenilir=false ise amirPersonnelId ATANMAZ; kaydet'te form doğrudan İK'ya gider.
    const amirSonuc = await amirCozumle(personnelId);
    const amirAd = amirSonuc.amirAd ?? "";
    const amirPersonnelId = amirSonuc.guvenilir ? amirSonuc.amirPersonnelId : null;
    const amirGuvenilir = amirSonuc.guvenilir;

    // IaPozisyon eşleştir → yetkinlik + makine
    const normHedef = normalizeAd(pozisyonAd);
    let pozisyonBulundu = false;
    let pozisyonId: string | null = null;
    const yetkinlikler: Array<{ yetkinlikId: string; ad: string; grup: string; tip: string; hedefSeviye: number }> = [];
    const makineler: string[] = [];

    const adaylar = await prisma.iaPozisyon.findMany({
      where: { aktif: true },
      include: { pozisyonYetkinlik: { include: { yetkinlik: true } } },
    });
    const iaPoz = adaylar.find((c) => normalizeAd(c.ad) === normHedef) ?? null;

    if (iaPoz) {
      pozisyonBulundu = true;
      pozisyonId = iaPoz.id;
      for (const py of iaPoz.pozisyonYetkinlik) {
        const y: any = py.yetkinlik;
        if (y?.makineKodu) {
          makineler.push(y.ad ? `${y.makineKodu} - ${y.ad}` : y.makineKodu);
        } else {
          yetkinlikler.push({
            yetkinlikId: y.id,
            ad: y.ad,
            grup: y.grup ?? "",
            tip: y.tip ?? "MESLEKI",
            hedefSeviye: py.hedefSeviye,
          });
        }
      }
    }

    return NextResponse.json({
      personel: {
        sicilNo: p?.sicilNo ?? "",
        adSoyad: p?.adSoyad ?? birincil.displayName,
        bolum: bolum.ad ?? p?.bolum ?? "",
        gorev: pozisyonAd,
        yaka: p?.yakaRengi ?? "MAVI",
        amir: amirAd,
      },
      amirPersonnelId, // onay akışı için (null olabilir)
      amirGuvenilir, // false → form doğrudan İK'ya gider, UI uyarı gösterir
      pozisyonId,
      pozisyonBulundu,
      makineler,
      yetkinlikler,
    });
  } catch (err) {
    console.error("[is-analizi/referans] hata:", err);
    return NextResponse.json({ error: "Referans verisi alınırken bir hata oluştu." }, { status: 500 });
  }
}

// ── Yardımcılar ────────────────────────────────────────────────────────
// Koltuk seçimi + kurul eleme + bölüm çözümleme → birincil-koltuk.ts TEK KAYNAK.
// (amirIdBul da kaldırılmıştı; amir → amir-cozumle.ts.)
