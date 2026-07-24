// prisma/seed-org-insan-varliklari.ts
// F1 — Organizasyon Şeması: İnsan Varlıkları Müdürlüğü PİLOT verisi
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-insan-varliklari.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-IV" ve "ORG-IV-*" kod uzayı
// temizlenip yeniden kurulur. Başka hiçbir bölüme/koda dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.

import { PrismaClient, OrgUnitType, OrgPositionStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── NORMALIZE (isim + unvan eşleştirme anahtarı) ────────────────────────

const DIACRITIC_MAP: Record<string, string> = {
  Ç: "C",
  Ğ: "G",
  Ş: "S",
  Ö: "O",
  Ü: "U",
  İ: "I", // dotted upper İ -> ASCII I (dotless ı zaten default upper'da I olur)
};

function normalize(input: string): string {
  if (!input) return "";
  let s = input.toLocaleUpperCase("tr-TR");
  s = s.replace(/[ÇĞŞÖÜİ]/g, (ch) => DIACRITIC_MAP[ch] ?? ch);
  s = s.replace(/^DR\.?\s+/, ""); // "Dr." / "Dr " öneki
  s = s.replace(/\s+V\.?$/, ""); // sonda " V." / " V" vekalet eki
  s = s.replace(/[^A-Z0-9]+/g, " ");
  return s.trim().replace(/\s+/g, " ");
}

// ─── AĞAÇ TANIMI ──────────────────────────────────────────────────────────

type MatchMode = "INTERNAL" | "EXTERNAL" | "NONE";

interface SeedNode {
  code: string;
  parentCode: string | null;
  unitType: keyof typeof OrgUnitType;
  name: string;
  level: number;
  sortOrder: number;
  approvedHeadcount: number | null;
  isExternal: boolean;
  matchMode: MatchMode;
  employees: string[]; // displayName listesi (vacant kutularda boş)
  vacant?: boolean; // true: onaylı kadro var ama kasten boş, OrgEmployee YOK
  probe?: boolean; // true: dış kaynak sayılsa da Personnel'de teşhis araması yap
}

const NODES: SeedNode[] = [
  {
    code: "ORG-IV",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "İnsan Varlıkları Müdürlüğü",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    isExternal: false,
    matchMode: "NONE",
    employees: [],
  },
  {
    code: "ORG-IV-P01",
    parentCode: "ORG-IV",
    unitType: "POSITION",
    name: "İnsan Varlıkları Müdürü",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: ["Elif Kasar"],
  },
  {
    code: "ORG-IV-P02",
    parentCode: "ORG-IV-P01",
    unitType: "POSITION",
    name: "İnsan Varlıkları Müdür Yardımcısı",
    level: 2,
    sortOrder: 0,
    approvedHeadcount: 1,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: ["Elif Karadeniz"],
  },
  {
    code: "ORG-IV-P03",
    parentCode: "ORG-IV-P02",
    unitType: "POSITION",
    name: "İnsan Varlıkları Sorumlusu",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: ["Gökçe Ekşioğlu"],
  },
  {
    code: "ORG-IV-P04",
    parentCode: "ORG-IV-P03",
    unitType: "POSITION",
    name: "İnsan Varlıkları Uzmanı",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: [],
    vacant: true,
  },
  {
    code: "ORG-IV-P05",
    parentCode: "ORG-IV-P02",
    unitType: "POSITION",
    name: "İdari İşler Sorumlusu",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: ["Ahmet Mesut Kara"],
  },
  {
    code: "ORG-IV-P06",
    parentCode: "ORG-IV-P05",
    unitType: "POSITION",
    name: "İdari İşler",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: ["Alaettin Erdoğan"],
  },
  {
    code: "ORG-IV-P07",
    parentCode: "ORG-IV-P05",
    unitType: "POSITION",
    name: "Çay/Temizlik Elemanı",
    level: 4,
    sortOrder: 1,
    approvedHeadcount: 1,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: ["Hatice Polat"],
  },
  {
    code: "ORG-IV-P08",
    parentCode: "ORG-IV-P05",
    unitType: "POSITION",
    name: "Meydancılar",
    level: 4,
    sortOrder: 2,
    approvedHeadcount: 3,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: ["Mustafa Cebeci", "Mesut Kabakkaya", "Necati İnan"],
  },
  {
    code: "ORG-IV-P09",
    parentCode: "ORG-IV-P05",
    unitType: "POSITION",
    name: "Şoför",
    level: 4,
    sortOrder: 3,
    approvedHeadcount: 1,
    isExternal: false,
    matchMode: "INTERNAL",
    employees: ["İsa Altay"],
  },
  {
    code: "ORG-IV-G01",
    parentCode: "ORG-IV-P02",
    unitType: "GROUP",
    name: "Danışmanlıklar",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: null,
    isExternal: true,
    matchMode: "NONE",
    employees: [],
  },
  {
    code: "ORG-IV-P10",
    parentCode: "ORG-IV-G01",
    unitType: "POSITION",
    name: "Çevre Mühendisi",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    isExternal: true,
    matchMode: "EXTERNAL",
    employees: ["Elif Şen"],
    probe: true,
  },
  {
    code: "ORG-IV-P11",
    parentCode: "ORG-IV-G01",
    unitType: "POSITION",
    name: "İSG Uzmanı",
    level: 4,
    sortOrder: 1,
    approvedHeadcount: 1,
    isExternal: true,
    matchMode: "EXTERNAL",
    employees: ["Aleyna Burak"],
    probe: true,
  },
  {
    code: "ORG-IV-P12",
    parentCode: "ORG-IV-G01",
    unitType: "POSITION",
    name: "İşyeri Hekimi",
    level: 4,
    sortOrder: 2,
    approvedHeadcount: 1,
    isExternal: true,
    matchMode: "EXTERNAL",
    employees: ["Dr. Mustafa Cengiz"],
  },
  {
    code: "ORG-IV-P13",
    parentCode: "ORG-IV-G01",
    unitType: "POSITION",
    name: "Avukat",
    level: 4,
    sortOrder: 3,
    approvedHeadcount: 3,
    isExternal: true,
    matchMode: "EXTERNAL",
    employees: ["Selçuk Donat", "Mert Aksoy", "Mehmet Kütük"],
  },
];

// ─── SORUMLU TABLOSU (yalnız ORG-IV düğümü) ──────────────────────────────

const SORUMLULUKLAR: { sira: number; birinciSorumlu: string; yedekSorumlu: string }[] = [
  { sira: 1, birinciSorumlu: "Elif Kasar", yedekSorumlu: "Elif Karadeniz" },
  { sira: 2, birinciSorumlu: "Elif Karadeniz", yedekSorumlu: "Gökçe Ekşioğlu" },
  { sira: 3, birinciSorumlu: "Gökçe Ekşioğlu", yedekSorumlu: "Elif Karadeniz" },
  { sira: 4, birinciSorumlu: "A. Mesut Kara", yedekSorumlu: "Alaettin Erdoğan" },
  { sira: 5, birinciSorumlu: "Alaettin Erdoğan", yedekSorumlu: "İsa Altay" },
];

// ─── RAPOR BİRİKTİRİCİLERİ ────────────────────────────────────────────────

interface GozdenGecirEntry {
  isim: string;
  kutuKodu: string;
  etiket: string;
}

interface TanimsizRolEntry {
  kutuKodu: string;
  unvan: string;
}

interface BoxReportRow {
  kod: string;
  unvan: string;
  n: number;
  m: number;
  rozet: string;
}

const gozdenGecir: GozdenGecirEntry[] = [];
const tanimsizRol: TanimsizRolEntry[] = [];
const probeUyarilari: string[] = [];
const boxRaporu: BoxReportRow[] = [];

async function main() {
  console.log("F1 — İnsan Varlıkları pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-IV / ORG-IV-* kapsamı ──────────
  // Tam eşleşme "ORG-IV" ya da "ORG-IV-" öneki: "ORG-IVX" gibi bir kod
  // yanlışlıkla yakalanmaz (startsWith("ORG-IV") tek başına yakalardı).
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-IV" }, { code: { startsWith: "ORG-IV-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-IV* OrgUnit kaydı.\n`);
  }

  // ── 2) Personnel / Position — SADECE OKUMA ──────────────────────────────
  const aktifPersonel = await prisma.personnel.findMany({
    where: { aktif: true },
    select: { id: true, adSoyad: true },
  });
  const aktifPozisyon = await prisma.position.findMany({
    where: { isActive: true },
    select: { id: true, title: true },
  });

  const personelMap = new Map<string, { id: string; adSoyad: string }[]>();
  for (const p of aktifPersonel) {
    const key = normalize(p.adSoyad);
    const arr = personelMap.get(key) ?? [];
    arr.push(p);
    personelMap.set(key, arr);
  }

  const pozisyonMap = new Map<string, { id: string; title: string }[]>();
  for (const pos of aktifPozisyon) {
    const key = normalize(pos.title);
    const arr = pozisyonMap.get(key) ?? [];
    arr.push(pos);
    pozisyonMap.set(key, arr);
  }

  // ── 3) OrgUnit ağacını kur (parent önce, id map ile) ────────────────────
  const idByCode = new Map<string, string>();
  let orgUnitSayisi = 0;

  for (const node of NODES) {
    const parentId = node.parentCode ? idByCode.get(node.parentCode) ?? null : null;

    let positionId: string | null = null;
    if (node.unitType === "POSITION") {
      const eslesenler = pozisyonMap.get(normalize(node.name)) ?? [];
      if (eslesenler.length === 1) {
        positionId = eslesenler[0].id;
      } else {
        tanimsizRol.push({ kutuKodu: node.code, unvan: node.name });
      }
    }

    const created = await prisma.orgUnit.create({
      data: {
        code: node.code,
        name: node.name,
        unitType: OrgUnitType[node.unitType],
        parentId,
        level: node.level,
        sortOrder: node.sortOrder,
        approvedHeadcount: node.approvedHeadcount,
        isExternal: node.isExternal,
        positionStatus: OrgPositionStatus.AKTIF,
        positionId,
      },
    });
    idByCode.set(node.code, created.id);
    orgUnitSayisi++;
  }

  // ── 4) Teşhis probe (P10/P11) — davranışı DEĞİŞTİRMEZ, yalnız raporlar ──
  for (const node of NODES) {
    if (!node.probe) continue;
    for (const isim of node.employees) {
      const eslesenler = personelMap.get(normalize(isim)) ?? [];
      for (const e of eslesenler) {
        probeUyarilari.push(
          `UYARI: ${isim} dış kaynak sayıldı ama Personnel'de aktif kayıt var (id=${e.id}) — Elif doğrulasın`
        );
      }
    }
  }

  // ── 5) OrgEmployee kayıtları ─────────────────────────────────────────────
  let orgEmployeeSayisi = 0;

  for (const node of NODES) {
    if (node.unitType !== "POSITION") continue;
    const orgUnitId = idByCode.get(node.code)!;
    let m = 0;

    if (node.vacant) {
      // Kasten boş kadro: OrgEmployee oluşturulmaz, GÖZDEN GEÇİR'e yazılmaz.
      m = 0;
    } else if (node.matchMode === "EXTERNAL") {
      for (const isim of node.employees) {
        await prisma.orgEmployee.create({
          data: {
            orgUnitId,
            displayName: isim,
            personnelId: null,
          },
        });
        m++;
      }
    } else if (node.matchMode === "INTERNAL") {
      for (const isim of node.employees) {
        const eslesenler = personelMap.get(normalize(isim)) ?? [];
        let personnelId: string | null = null;
        if (eslesenler.length === 1) {
          personnelId = eslesenler[0].id;
        } else if (eslesenler.length === 0) {
          gozdenGecir.push({ isim, kutuKodu: node.code, etiket: "eşleşme yok" });
        } else {
          gozdenGecir.push({ isim, kutuKodu: node.code, etiket: `belirsiz-${eslesenler.length} adet` });
        }
        await prisma.orgEmployee.create({
          data: {
            orgUnitId,
            displayName: isim,
            personnelId,
          },
        });
        m++;
      }
    }
    orgEmployeeSayisi += m;

    const n = node.approvedHeadcount ?? 0;
    const rozet = m === n ? `Tam ${m}/${n}` : m === 0 ? `Boş 0/${n}` : `Eksik ${m}/${n}`;
    boxRaporu.push({ kod: node.code, unvan: node.name, n, m, rozet });
  }

  // ── 6) OrgBolumMeta + OrgSorumluluk (yalnız ORG-IV) ─────────────────────
  const orgIvId = idByCode.get("ORG-IV")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgIvId,
      dokumanNo: "IV-LS-45",
      ilkYayinTarihi: new Date("2012-01-30"),
      revNo: "3",
      sayNo: "1/1",
      hazirlayan: "Elif KASAR",
      yonetimTemsilcisi: null,
      gmOnayi: "Halit İLERİ",
      gizlilik: "HİZMETE ÖZEL",
      isoMadde: "ISO 9001:2015 / IATF 16949 Madde No: 7.3.2",
    },
  });

  for (const s of SORUMLULUKLAR) {
    await prisma.orgSorumluluk.create({
      data: {
        orgUnitId: orgIvId,
        sira: s.sira,
        birinciSorumlu: s.birinciSorumlu,
        yedekSorumlu: s.yedekSorumlu,
      },
    });
  }

  // ── 7) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — İnsan Varlıkları Pilotu ===\n");
  console.log(`Kurulan OrgUnit sayısı   : ${orgUnitSayisi}`);
  console.log(`Kurulan OrgEmployee sayısı: ${orgEmployeeSayisi}\n`);

  console.log("Kutu bazında durum:");
  console.log("kod           | unvan                          | N | M | rozet");
  console.log("-".repeat(80));
  for (const r of boxRaporu) {
    console.log(
      `${r.kod.padEnd(13)} | ${r.unvan.padEnd(30)} | ${String(r.n).padEnd(1)} | ${String(r.m).padEnd(1)} | ${r.rozet}`
    );
  }

  console.log("\nGÖZDEN GEÇİR listesi:");
  if (gozdenGecir.length === 0) {
    console.log("(boş)");
  } else {
    for (const g of gozdenGecir) {
      console.log(`${g.isim} | ${g.kutuKodu} | ${g.etiket}`);
    }
  }

  console.log("\nTANIMSIZ ROL listesi:");
  if (tanimsizRol.length === 0) {
    console.log("(boş)");
  } else {
    for (const t of tanimsizRol) {
      console.log(`${t.kutuKodu} | ${t.unvan}`);
    }
  }

  console.log("\nTeşhis UYARI satırları (P10/P11 probe):");
  if (probeUyarilari.length === 0) {
    console.log("(boş)");
  } else {
    for (const u of probeUyarilari) {
      console.log(u);
    }
  }

  console.log("\nF1 İnsan Varlıkları pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
