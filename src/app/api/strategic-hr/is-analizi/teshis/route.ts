// GET /api/strategic-hr/is-analizi/teshis?personnelId=...  (veya ?sicilNo=...)
// İş Analizi TEŞHİS — bir kullanıcının IA formu neden açılmıyor/yanlış çözülüyor
// sorusunu tek bakışta yanıtlar: koltukları, birincil seçilen, elenenler (+sebep),
// amir çözümü (ORG/ISIM/YOK + guvenilir), IaPozisyon eşleşti mi.
//
// Erişim: yalnız İK (rol.ik). Hedef seçilmezse giriş yapan kullanıcının kendisi.
// KVKK: yalnız org/pozisyon meta verisi döner; hassas Personnel alanı DÖNMEZ.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle, iaYetkisiz } from "@/lib/is-analizi/ia-yetki";
import { birincilKoltukBul } from "@/lib/is-analizi/birincil-koltuk";
import { amirCozumle } from "@/lib/is-analizi/amir-cozumle";

function normalizeAd(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_x000D_/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

export async function GET(req: NextRequest) {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;
  if (!rol.ik) return iaYetkisiz();

  try {
    // Hedef personnelId: query (İK başkasını teşhis edebilir) → yoksa kendisi
    const qPersonnelId = req.nextUrl.searchParams.get("personnelId");
    const qSicilNo = req.nextUrl.searchParams.get("sicilNo");

    let personnelId: string | null = qPersonnelId;
    if (!personnelId && qSicilNo) {
      const p = await prisma.personnel.findFirst({ where: { sicilNo: qSicilNo }, select: { id: true } });
      personnelId = p?.id ?? null;
      if (!personnelId) {
        return NextResponse.json({ error: `Sicil ${qSicilNo} ile personel bulunamadı.` }, { status: 404 });
      }
    }
    if (!personnelId) personnelId = rol.personnelId;
    if (!personnelId) {
      return NextResponse.json({ error: "Teşhis edilecek personel belirlenemedi." }, { status: 400 });
    }

    const kisi = await prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { adSoyad: true, sicilNo: true, gorev: true, bolum: true, yakaRengi: true, birimSorumlusu: true },
    });

    // Tüm koltuklar (ham)
    const koltuklar = await prisma.orgEmployee.findMany({
      where: { personnelId, isActive: true },
      select: {
        id: true,
        displayName: true,
        orgUnit: { select: { code: true, name: true, unitType: true, level: true } },
      },
    });

    // Birincil koltuk + eleme gerekçeleri
    const koltuk = await birincilKoltukBul(personnelId);

    // Amir çözümü
    const amir = await amirCozumle(personnelId);

    // IaPozisyon eşleşmesi (birincil pozisyon adına göre)
    let iaPozisyonEslesme: { bulundu: boolean; ad: string | null; id: string | null; yetkinlikSayisi: number } = {
      bulundu: false,
      ad: null,
      id: null,
      yetkinlikSayisi: 0,
    };
    if (koltuk) {
      const hedef = normalizeAd(koltuk.secilen.orgUnitAd);
      const adaylar = await prisma.iaPozisyon.findMany({
        where: { aktif: true },
        select: { id: true, ad: true, _count: { select: { pozisyonYetkinlik: true } } },
      });
      const eslesen = adaylar.find((c) => normalizeAd(c.ad) === hedef) ?? null;
      iaPozisyonEslesme = {
        bulundu: !!eslesen,
        ad: eslesen?.ad ?? null,
        id: eslesen?.id ?? null,
        yetkinlikSayisi: eslesen?._count.pozisyonYetkinlik ?? 0,
      };
    }

    // Formun açılıp açılmayacağının özeti
    const formAcilir = !!koltuk && iaPozisyonEslesme.bulundu;
    const engel = !koltuk
      ? "Ana pozisyon çözülemedi (koltuk yok veya yalnız kurul üyeliği)."
      : !iaPozisyonEslesme.bulundu
        ? "Pozisyon için IaPozisyon tanımı yok (seed gerekli) → kayıt engellenir."
        : null;

    return NextResponse.json({
      personel: kisi
        ? { adSoyad: kisi.adSoyad, sicilNo: kisi.sicilNo, gorev: kisi.gorev, bolum: kisi.bolum, yaka: kisi.yakaRengi, birimSorumlusu: kisi.birimSorumlusu }
        : null,
      koltukSayisi: koltuklar.length,
      koltuklar: koltuklar.map((k) => ({
        kod: k.orgUnit?.code ?? "?",
        pozisyon: k.orgUnit?.name ?? "?",
        tip: k.orgUnit?.unitType ?? "?",
        level: k.orgUnit?.level ?? null,
      })),
      birincil: koltuk
        ? {
            pozisyon: koltuk.secilen.orgUnitAd,
            kod: koltuk.secilen.orgUnitKod,
            bolum: koltuk.secilen.departmanAd,
            level: koltuk.secilen.level,
          }
        : null,
      elenenler: koltuk?.elenenler ?? [],
      amir: { kaynak: amir.kaynak, ad: amir.amirAd, personnelId: amir.amirPersonnelId, guvenilir: amir.guvenilir },
      iaPozisyon: iaPozisyonEslesme,
      sonuc: { formAcilir, engel },
    });
  } catch (err) {
    console.error("[is-analizi/teshis] hata:", err);
    return NextResponse.json({ error: "Teşhis çalıştırılırken bir hata oluştu." }, { status: 500 });
  }
}
