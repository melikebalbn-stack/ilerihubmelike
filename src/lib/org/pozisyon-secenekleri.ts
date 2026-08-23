import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { normalizeAd } from "./koltuk-eslesme";

// Personel kartındaki "Görev" alanının seçenek kaynağı = organizasyon şemasındaki
// POSITION kutu adları. Personnel.gorev String KALIR (FK yok) — bağ ekran ve
// doğrulama seviyesinde kurulur.
//
// Kapsam kuralları koltuk-eslesme.ts ile AYNI olmalı, yoksa listeden seçilen görev
// eşleşmeyip koltuk açılmaz:
//   - yalnız aktif POSITION
//   - kurul/komite birimleri (ORG-KR-*) HARİÇ — onlar ek görev, ana görev değil
//   - yalnız "canlı" ağaçlar (altında en az bir açık koltuk olan kök)

type DbClient = Prisma.TransactionClient | typeof prisma;

const MAX_DERINLIK = 15;
const KURUL_ONEKI = "ORG-KR-";

export interface PozisyonSecenegi {
  /** Şemadaki yazımı — eşleştirme bu değerle yapılır. */
  ad: string;
  /** Ekranda gösterilen hâli (Personnel.gorev biçimiyle tutarlı). */
  adBuyuk: string;
  /** Bu unvanın geçtiği kutuların üst zincirindeki birim adları (bölüme göre süzme için). */
  zincir: string[];
  /** Aynı unvanda kaç kutu var (bilgi amaçlı). */
  kutuSayisi: number;
  /** Bu unvanda boş kutu var mı — İK "kadro var mı" görebilsin. */
  bosKutuVar: boolean;
}

/** Türkçe büyük harf — düz toUpperCase() Türkçe'de i/ı'yı bozar. */
export function buyukTR(s: string): string {
  return (s ?? "").toLocaleUpperCase("tr-TR");
}

export async function pozisyonSecenekleriYukle(db: DbClient = prisma): Promise<PozisyonSecenegi[]> {
  const units = await db.orgUnit.findMany({
    select: { id: true, code: true, name: true, parentId: true, unitType: true, isActive: true },
  });
  const byId = new Map(units.map((u) => [u.id, u]));

  const zincirAl = (id: string): typeof units => {
    const out: typeof units = [];
    let cur = byId.get(id);
    for (let i = 0; i < MAX_DERINLIK && cur; i++) {
      out.push(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out;
  };

  const koltuklu = await db.orgEmployee.groupBy({
    by: ["orgUnitId"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const acikKoltuk = new Map(koltuklu.map((k) => [k.orgUnitId, k._count._all]));
  const canliKokler = new Set<string>();
  for (const k of koltuklu) {
    const z = zincirAl(k.orgUnitId);
    const kok = z[z.length - 1];
    if (kok) canliKokler.add(kok.id);
  }

  const gruplar = new Map<string, PozisyonSecenegi>();
  for (const u of units) {
    if (u.unitType !== "POSITION" || !u.isActive) continue;
    if (u.code?.startsWith(KURUL_ONEKI)) continue;
    const zincir = zincirAl(u.id);
    const kok = zincir[zincir.length - 1];
    if (!kok || !canliKokler.has(kok.id)) continue;

    const anahtar = normalizeAd(u.name);
    if (!anahtar) continue;
    const mevcut = gruplar.get(anahtar);
    const ustler = zincir.slice(1).map((z) => z.name);
    const bos = (acikKoltuk.get(u.id) ?? 0) === 0;
    if (mevcut) {
      mevcut.kutuSayisi += 1;
      mevcut.bosKutuVar = mevcut.bosKutuVar || bos;
      ustler.forEach((n) => { if (!mevcut.zincir.includes(n)) mevcut.zincir.push(n); });
    } else {
      gruplar.set(anahtar, {
        ad: u.name,
        adBuyuk: buyukTR(u.name),
        zincir: ustler,
        kutuSayisi: 1,
        bosKutuVar: bos,
      });
    }
  }

  return [...gruplar.values()].sort((a, b) => a.adBuyuk.localeCompare(b.adBuyuk, "tr-TR"));
}

/**
 * Bölüm ↔ şema dalı eşlemesi. koltuk-eslesme.ts'teki bolumUyuyorMu ile AYNI kural:
 * normalize edilmiş adlarda eşitlik veya kapsama ("KALİTE MÜDÜRLÜĞÜ" ↔ "Kalite").
 * Eşleşme bulunamazsa süzme yapılmaz — çağıran tüm listeyi gösterir.
 */
export function bolumeUyanlar(secenekler: PozisyonSecenegi[], bolum: string): PozisyonSecenegi[] {
  const b = normalizeAd(bolum);
  if (!b) return secenekler;
  const uyan = secenekler.filter((s) =>
    s.zincir.some((z) => {
      const n = normalizeAd(z);
      return !!n && (n === b || n.includes(b) || b.includes(n));
    }),
  );
  return uyan.length > 0 ? uyan : secenekler;
}
