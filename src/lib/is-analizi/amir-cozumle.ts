import { prisma } from "@/lib/prisma";
import { birincilKoltukBul } from "@/lib/is-analizi/birincil-koltuk";
import { adNormalize } from "@/lib/org/normalize-ad";

// İş Analizi — amir (yönetici) çözümleme TEK KAYNAK.
// Öncelik: (1) ORG ağacı, (2) Personnel.birimSorumlusu ismi, (3) yok.
// Koltuk seçimi (kurul eleme dahil) birincil-koltuk.ts'te; burada tekrar hesaplanmaz →
// amir de kurul koltuğundan çözülmez.

export type AmirKaynak = "ORG" | "ISIM" | null;

export interface AmirSonuc {
  amirPersonnelId: string | null;
  amirAd: string | null;
  kaynak: AmirKaynak;
  guvenilir: boolean; // amirPersonnelId kesin çözüldüyse true
}

const MAX_HIYERARSI_DERINLIGI = 15;

// Ad eşleşmesi TEK KAYNAK: @/lib/org/normalize-ad. Yereldeki eski tanım yalnız
// büyük harf + boşluk sadeleştirmesi yapıyordu; aksan ve vekâlet eki ("V." öneki,
// "(V)" soneki) taşıyan sorumlu yazımları eşleşmiyordu.
function normalizeAd(s: string | null | undefined): string {
  return adNormalize(s ?? "");
}

// İsimden Personnel.id — normalize tam eşleşme. TEK eşleşmede döner; 0 veya >1'de null.
async function isimdenPersonnelId(ad: string): Promise<string | null> {
  const norm = normalizeAd(ad);
  if (!norm) return null;
  const adaylar = await prisma.personnel.findMany({
    where: { aktif: true },
    select: { id: true, adSoyad: true },
  });
  const eslesenler = adaylar.filter((a) => normalizeAd(a.adSoyad) === norm);
  return eslesenler.length === 1 ? eslesenler[0].id : null;
}

// ORG ağacından amir: önce doğrudan raporlama hattı (OrgEmployee.reportsToId), yoksa
// parent zincirinde SAHİPLİ bir POSITION birimi (üstteki yönetici pozisyonun sahibi).
// Her iki durumda da amirin Personnel.id + adı döner. Kendisi hariç tutulur.
// seat = birincil-koltuk.ts'in seçtiği koltuk (kurul zaten elenmiş).
async function orgdanAmir(
  seat: { reportsToId: string | null; orgUnitParentId: string | null },
  kendiPersonnelId: string,
): Promise<{ id: string; ad: string | null } | null> {
  // 1) Doğrudan raporlama hattı
  if (seat.reportsToId) {
    const mgr = await prisma.orgEmployee.findUnique({
      where: { id: seat.reportsToId },
      select: { personnelId: true },
    });
    if (mgr?.personnelId && mgr.personnelId !== kendiPersonnelId) {
      const p = await prisma.personnel.findUnique({ where: { id: mgr.personnelId }, select: { adSoyad: true } });
      return { id: mgr.personnelId, ad: p?.adSoyad ?? null };
    }
  }
  // 2) Parent zincirinde sahipli POSITION (üstteki yönetici pozisyonun sahibi)
  let currentId: string | null = seat.orgUnitParentId;
  for (let i = 0; i < MAX_HIYERARSI_DERINLIGI; i++) {
    if (!currentId) break;
    const uid: string = currentId;
    const u = await prisma.orgUnit.findUnique({
      where: { id: uid },
      select: {
        parentId: true,
        unitType: true,
        employees: {
          where: { isActive: true, personnelId: { not: null } },
          select: { personnelId: true },
        },
      },
    });
    if (!u) break;
    if (u.unitType === "POSITION") {
      const sahip = u.employees.find((e) => e.personnelId && e.personnelId !== kendiPersonnelId);
      if (sahip?.personnelId) {
        const p = await prisma.personnel.findUnique({ where: { id: sahip.personnelId }, select: { adSoyad: true } });
        return { id: sahip.personnelId, ad: p?.adSoyad ?? null };
      }
    }
    currentId = u.parentId;
  }
  return null;
}

/**
 * Bir personelin amirini çözer. Sıra:
 *   1. ORG ağacı (reportsTo / üst POSITION sahibi) → kaynak 'ORG', guvenilir=true
 *   2. Personnel.birimSorumlusu ismi → TEK eşleşme → kaynak 'ISIM', guvenilir=true;
 *      0/>1 eşleşmede amirAd gösterilir ama amirPersonnelId=null, guvenilir=false
 *   3. Hiçbiri → hepsi null, guvenilir=false
 */
export async function amirCozumle(personnelId: string): Promise<AmirSonuc> {
  // 1. ORG — birincil koltuk (kurul elenmiş) üzerinden amir
  const koltuk = await birincilKoltukBul(personnelId);
  if (koltuk) {
    const org = await orgdanAmir(koltuk.secilen, personnelId);
    if (org?.id) {
      return { amirPersonnelId: org.id, amirAd: org.ad, kaynak: "ORG", guvenilir: true };
    }
  }

  // 2. İSİM (birimSorumlusu)
  const p = await prisma.personnel.findUnique({ where: { id: personnelId }, select: { birimSorumlusu: true } });
  const amirAd = p?.birimSorumlusu ?? null;
  if (amirAd) {
    const id = await isimdenPersonnelId(amirAd);
    return { amirPersonnelId: id, amirAd, kaynak: "ISIM", guvenilir: id != null };
  }

  // 3. Yok
  return { amirPersonnelId: null, amirAd: null, kaynak: null, guvenilir: false };
}
