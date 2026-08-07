import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

// Org şeması — Personnel ↔ OrgUnit (POSITION) eşleştirmesi. TEK KAYNAK.
// Script'ler (org-koltuk-olustur, org-mukerrer-koltuk) ve otomatik senkron
// (personelEklendiginde) AYNI bu fonksiyonu kullanır; eşleştirme mantığı kopyalanmaz.
//
// KURAL (sırayla):
//   1. Personnel.gorev ↔ OrgUnit.name TAM eşleşme (Türkçe normalize)
//   2. Adayın üst zinciri Personnel.bolum ile uyuşmalı
//   3. Tek kesin aday yoksa eslesmedi (belirsizlikte koltuk AÇILMAZ)
//   4. Kurul birimleri (ORG-KR-*) asla eşleşme sonucu olamaz
//   5. Yalnız "canlı" ağaçlar hedef olabilir — hiç açık koltuğu olmayan kök
//      yerleşim hedefi değildir. Prod'da ORG-TF ("İleri Group (Tüm Firma)")
//      125 birim / 0 koltuk ile duran bir ayna ağaç; her unvanı ikizlediği için
//      dışlanmazsa her eşleşme "birden fazla aday"a düşer. Kural veriden
//      türetilir (kod öneki gömülmez): ağaç koltuk kazanırsa kendiliğinden aday olur.

type DbClient = Prisma.TransactionClient | typeof prisma;

const MAX_DERINLIK = 15;
const KURUL_ONEKI = "ORG-KR-";

const DIACRITIC_MAP: Record<string, string> = {
  Ç: "C",
  Ğ: "G",
  Ş: "S",
  Ö: "O",
  Ü: "U",
  İ: "I",
};

// prisma/seed-org-*.ts ile aynı normalize ailesi (aksan + boşluk + noktalama).
export function normalizeAd(input: string): string {
  if (!input) return "";
  let s = input.toLocaleUpperCase("tr-TR");
  s = s.replace(/[ÇĞŞÖÜİ]/g, (ch) => DIACRITIC_MAP[ch] ?? ch);
  s = s.replace(/[^A-Z0-9]+/g, " ");
  return s.trim().replace(/\s+/g, " ");
}

export type EslesmeSonuc =
  | { eslesti: true; orgUnitId: string; code: string; name: string; ustZincir: string[] }
  | { eslesti: false; sebep: string; adaylar: { code: string; name: string }[] };

export type PersonelGirdi = { bolum: string; gorev: string };

type UnitRow = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  unitType: string;
  isActive: boolean;
};

// Tüm birimleri bir kez okuyup bellekte çalışırız — 28 kişilik döngüde N+1 sorgu olmasın.
export type EslesmeIndeksi = {
  unitById: Map<string, UnitRow>;
  adayaGoreIsim: Map<string, UnitRow[]>;
  canliKokler: Set<string>;
};

export async function eslesmeIndeksiYukle(db: DbClient = prisma): Promise<EslesmeIndeksi> {
  const units = await db.orgUnit.findMany({
    select: { id: true, code: true, name: true, parentId: true, unitType: true, isActive: true },
  });
  const unitById = new Map(units.map((u) => [u.id, u as UnitRow]));

  const kokBul = (u: UnitRow): string => {
    let cur = u;
    for (let i = 0; i < MAX_DERINLIK && cur.parentId; i++) {
      const p = unitById.get(cur.parentId);
      if (!p) break;
      cur = p;
    }
    return cur.id;
  };

  // (5) Canlı kök = altında en az bir AÇIK koltuk bulunan ağaç.
  const koltuklu = await db.orgEmployee.groupBy({
    by: ["orgUnitId"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const canliKokler = new Set<string>();
  for (const k of koltuklu) {
    const u = unitById.get(k.orgUnitId);
    if (u) canliKokler.add(kokBul(u));
  }

  const adayaGoreIsim = new Map<string, UnitRow[]>();
  for (const u of units as UnitRow[]) {
    if (u.unitType !== "POSITION" || !u.isActive) continue;
    const key = normalizeAd(u.name);
    if (!key) continue;
    const arr = adayaGoreIsim.get(key) ?? [];
    arr.push(u);
    adayaGoreIsim.set(key, arr);
  }

  return { unitById, adayaGoreIsim, canliKokler };
}

function ustZincir(ix: EslesmeIndeksi, u: UnitRow): UnitRow[] {
  const zincir: UnitRow[] = [];
  let cur: UnitRow | undefined = u;
  for (let i = 0; i < MAX_DERINLIK && cur; i++) {
    zincir.push(cur);
    cur = cur.parentId ? ix.unitById.get(cur.parentId) : undefined;
  }
  return zincir;
}

// Bölüm uyumu: adayın üst zincirindeki HERHANGİ bir birim adı, Personnel.bolum ile
// aynı normalize değere sahip veya biri diğerini kapsıyor ("KALİTE MÜDÜRLÜĞÜ" ↔ "Kalite").
function bolumUyuyorMu(ix: EslesmeIndeksi, aday: UnitRow, bolum: string): boolean {
  const b = normalizeAd(bolum);
  if (!b) return false;
  for (const z of ustZincir(ix, aday)) {
    const n = normalizeAd(z.name);
    if (!n) continue;
    if (n === b || n.includes(b) || b.includes(n)) return true;
  }
  return false;
}

export function pozisyonEslesmesiBul(
  ix: EslesmeIndeksi,
  personel: PersonelGirdi,
): EslesmeSonuc {
  const gorevKey = normalizeAd(personel.gorev);
  if (!gorevKey) return { eslesti: false, sebep: "gorev bos", adaylar: [] };

  const hamAdaylar = ix.adayaGoreIsim.get(gorevKey) ?? [];
  if (hamAdaylar.length === 0) {
    return { eslesti: false, sebep: "pozisyon yok (bu unvanda OrgUnit tanimli degil)", adaylar: [] };
  }

  // (4) kurul birimleri hedef olamaz
  const kurulsuz = hamAdaylar.filter((u) => !u.code.startsWith(KURUL_ONEKI));
  if (kurulsuz.length === 0) {
    return { eslesti: false, sebep: "yalniz kurul biriminde eslesme (kurul koltugu acilmaz)", adaylar: hamAdaylar.map(k) };
  }

  // (5) yalnız canlı ağaçlar
  const canli = kurulsuz.filter((u) => {
    const zincir = ustZincir(ix, u);
    const kok = zincir[zincir.length - 1];
    return kok ? ix.canliKokler.has(kok.id) : false;
  });
  if (canli.length === 0) {
    return { eslesti: false, sebep: "aday yalniz kullanilmayan agacta (koltuksuz kok)", adaylar: kurulsuz.map(k) };
  }

  // (2) bölüm doğrulaması
  const bolumluk = canli.filter((u) => bolumUyuyorMu(ix, u, personel.bolum));
  if (bolumluk.length === 0) {
    return {
      eslesti: false,
      sebep: `bolum uyusmuyor (personel bolumu: ${personel.bolum})`,
      adaylar: canli.map(k),
    };
  }
  if (bolumluk.length > 1) {
    return {
      eslesti: false,
      sebep: `birden fazla aday (${bolumluk.length})`,
      adaylar: bolumluk.map(k),
    };
  }

  const secilen = bolumluk[0];
  return {
    eslesti: true,
    orgUnitId: secilen.id,
    code: secilen.code,
    name: secilen.name,
    ustZincir: ustZincir(ix, secilen).map((z) => z.name),
  };
}

function k(u: UnitRow) {
  return { code: u.code, name: u.name };
}
