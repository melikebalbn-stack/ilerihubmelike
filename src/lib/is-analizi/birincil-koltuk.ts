import { prisma } from "@/lib/prisma";

// İş Analizi — birincil koltuk (ana pozisyon) seçimi TEK KAYNAK.
// Hem referans/route.ts (pozisyon+bölüm) hem amir-cozumle.ts (amir) buradan besleniyor;
// koltuk seçimi iki ayrı yerde hesaplanmıyor.
//
// KURUL ELEME: kurullar (BGYS, Etik, Disiplin, KVKK, İzin, Çevre&İSG, QSB, MMOGLE)
// OrgUnit'te DEPARTMENT tipinde modellenmiş → unitType ile ayırt edilemez. Güvenilir
// tek ayraç birim KODU: 'ORG-KR-' ön eki (KR = Kurul). Bir koltuğun birimi veya üst
// zincirindeki HERHANGİ bir birim 'ORG-KR-' ise o koltuk birincil OLAMAZ. Sabit
// departman whitelist'i KULLANILMAZ (BGYS'yi kilitleyen eski hataydı) — dışlama kuralı.

const MAX_DERINLIK = 15;
const KURUL_KOD_ONEKI = "ORG-KR-";

export interface KoltukSecim {
  orgEmployeeId: string;
  displayName: string | null;
  orgUnitId: string;
  orgUnitKod: string;
  orgUnitAd: string;
  orgUnitParentId: string | null;
  level: number;
  reportsToId: string | null;
  departmanAd: string | null;
  departmanOrgUnitId: string | null;
}

export interface ElenenKoltuk {
  orgUnitKod: string;
  orgUnitAd: string;
  sebep: "KURUL" | "BIRIM_YOK" | "IKINCIL"; // neden birincil seçilmedi
}

export interface BirincilKoltukSonuc {
  secilen: KoltukSecim;
  elenenler: ElenenKoltuk[];
}

// Birimin kendisi veya üst zincirindeki herhangi bir birim kurul (ORG-KR-) mü?
async function kurulZincirindeMi(startUnitId: string): Promise<boolean> {
  let currentId: string | null = startUnitId;
  for (let i = 0; i < MAX_DERINLIK; i++) {
    if (!currentId) break;
    const uid: string = currentId;
    const u = await prisma.orgUnit.findUnique({ where: { id: uid }, select: { code: true, parentId: true } });
    if (!u) break;
    if (u.code.startsWith(KURUL_KOD_ONEKI)) return true;
    currentId = u.parentId;
  }
  return false;
}

// Parent zincirinde ilk DEPARTMENT birimi (bölüm). Yoksa null.
async function departmanBul(startUnitId: string): Promise<{ ad: string; orgUnitId: string } | null> {
  let currentId: string | null = startUnitId;
  for (let i = 0; i < MAX_DERINLIK; i++) {
    if (!currentId) break;
    const uid: string = currentId;
    const u = await prisma.orgUnit.findUnique({
      where: { id: uid },
      select: { id: true, name: true, parentId: true, unitType: true },
    });
    if (!u) break;
    if (u.unitType === "DEPARTMENT") return { ad: u.name, orgUnitId: u.id };
    currentId = u.parentId;
  }
  return null;
}

/**
 * Bir personelin birincil (ana) koltuğunu çözer.
 *   1. Tüm aktif koltukları al
 *   2. KURUL ELE: birimi/üst zinciri ORG-KR- olan koltukları çıkar
 *   3. Kalanlardan departmana bağlı olanlar öncelikli, sonra en düşük level
 *   4. Hepsi elendiyse (yalnız kurul koltuğu varsa) → null; çağıran anlamlı mesaj göstersin
 * elenenler[]: hangi koltuğun neden birincil olmadığı (teşhis için).
 */
export async function birincilKoltukBul(personnelId: string): Promise<BirincilKoltukSonuc | null> {
  const koltuklar = await prisma.orgEmployee.findMany({
    where: { personnelId, isActive: true },
    select: {
      id: true,
      displayName: true,
      reportsToId: true,
      orgUnitId: true,
      orgUnit: { select: { id: true, code: true, name: true, level: true, parentId: true } },
    },
  });
  if (koltuklar.length === 0) return null;

  const elenenler: ElenenKoltuk[] = [];
  const adaylar: Array<{
    k: (typeof koltuklar)[number];
    departman: { ad: string; orgUnitId: string } | null;
    level: number;
  }> = [];

  for (const k of koltuklar) {
    if (!k.orgUnit) {
      elenenler.push({ orgUnitKod: "?", orgUnitAd: "(birim yok)", sebep: "BIRIM_YOK" });
      continue;
    }
    if (await kurulZincirindeMi(k.orgUnitId)) {
      elenenler.push({ orgUnitKod: k.orgUnit.code, orgUnitAd: k.orgUnit.name, sebep: "KURUL" });
      continue;
    }
    const departman = await departmanBul(k.orgUnitId);
    adaylar.push({ k, departman, level: k.orgUnit.level ?? 999 });
  }

  if (adaylar.length === 0) return null; // yalnız kurul koltuğu var → ana pozisyon yok

  // Departmana bağlı olanlar öncelikli, sonra en düşük level
  adaylar.sort((a, b) => {
    const ad = a.departman ? 0 : 1;
    const bd = b.departman ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return a.level - b.level;
  });

  // Seçilmeyen adaylar da teşhis için elenenler'e (sebep: IKINCIL)
  for (let i = 1; i < adaylar.length; i++) {
    const ou = adaylar[i].k.orgUnit!;
    elenenler.push({ orgUnitKod: ou.code, orgUnitAd: ou.name, sebep: "IKINCIL" });
  }

  const s = adaylar[0];
  const ou = s.k.orgUnit!;
  return {
    secilen: {
      orgEmployeeId: s.k.id,
      displayName: s.k.displayName,
      orgUnitId: s.k.orgUnitId,
      orgUnitKod: ou.code,
      orgUnitAd: ou.name,
      orgUnitParentId: ou.parentId,
      level: s.level,
      reportsToId: s.k.reportsToId,
      departmanAd: s.departman?.ad ?? null,
      departmanOrgUnitId: s.departman?.orgUnitId ?? null,
    },
    elenenler,
  };
}
