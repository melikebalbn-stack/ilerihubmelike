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

const MAX_HIYERARSI_DERINLIGI = 12;

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

    // Kişinin tüm koltukları → birincil pozisyon (bölüm için)
    const koltuklar = await prisma.orgEmployee.findMany({
      where: { personnelId, isActive: true },
      select: {
        id: true,
        displayName: true,
        orgUnitId: true,
        orgUnit: { select: { id: true, name: true, parentId: true, unitType: true, level: true } },
      },
    });
    if (koltuklar.length === 0) {
      return NextResponse.json(
        { error: "Organizasyon şemasında aktif kaydınız bulunamadı. İnsan Varlıkları ile iletişime geçin." },
        { status: 404 }
      );
    }
    const birincil = await secBirincilKoltuk(koltuklar);
    if (!birincil || !birincil.orgUnit) {
      return NextResponse.json({ error: "Birincil pozisyonunuz belirlenemedi." }, { status: 404 });
    }

    const pozisyonAd = birincil.orgUnit.name;
    const bolum = await resolveBolum(birincil.orgUnitId);

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

// (amirIdBul kaldırıldı — amir hesabı artık amir-cozumle.ts TEK KAYNAK'ında.)

async function secBirincilKoltuk<
  T extends { orgUnitId: string; orgUnit: { level: number | null; parentId: string | null } | null }
>(koltuklar: T[]): Promise<T | null> {
  if (koltuklar.length === 1) return koltuklar[0];
  const skorlu: Array<{ k: T; departmanaBagli: boolean; level: number }> = [];
  for (const k of koltuklar) {
    const departmanaBagli = await zincirDepartmanaCikiyorMu(k.orgUnitId);
    skorlu.push({ k, departmanaBagli, level: k.orgUnit?.level ?? 999 });
  }
  skorlu.sort((a, b) => {
    if (a.departmanaBagli !== b.departmanaBagli) return a.departmanaBagli ? -1 : 1;
    return a.level - b.level;
  });
  return skorlu[0]?.k ?? null;
}

async function zincirDepartmanaCikiyorMu(startUnitId: string): Promise<boolean> {
  let currentId: string | null = startUnitId;
  for (let i = 0; i < MAX_HIYERARSI_DERINLIGI; i++) {
    if (!currentId) break;
    const uid: string = currentId; // TS7022 döngüsel çıkarımı kır
    const u = await prisma.orgUnit.findUnique({
      where: { id: uid },
      select: { parentId: true, unitType: true },
    });
    if (!u) return false;
    if (u.unitType === "DEPARTMENT") return true;
    currentId = u.parentId;
  }
  return false;
}

async function resolveBolum(
  startUnitId: string
): Promise<{ ad: string | null; orgUnitId: string | null }> {
  let currentId: string | null = startUnitId;
  let sonUlasilan: { ad: string | null; orgUnitId: string | null } = { ad: null, orgUnitId: null };
  for (let i = 0; i < MAX_HIYERARSI_DERINLIGI; i++) {
    if (!currentId) break;
    const uid: string = currentId; // TS7022 döngüsel çıkarımı kır
    const u = await prisma.orgUnit.findUnique({
      where: { id: uid },
      select: { id: true, name: true, parentId: true, unitType: true },
    });
    if (!u) break;
    sonUlasilan = { ad: u.name, orgUnitId: u.id };
    if (u.unitType === "DEPARTMENT") return { ad: u.name, orgUnitId: u.id };
    currentId = u.parentId;
  }
  return sonUlasilan;
}
