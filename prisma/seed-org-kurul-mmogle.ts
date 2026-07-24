// prisma/seed-org-kurul-mmogle.ts
// F1 — Organizasyon Şeması: MMOGLE Kurulu PİLOT verisi (EK-A A.10)
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-kurul-mmogle.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-KR-MMOGLE" ve "ORG-KR-MMOGLE-*" kod
// uzayı temizlenip yeniden kurulur. Diğer kurullara (ORG-KR-IZIN, ORG-KR-ETIK,
// ORG-KR-DISIPLIN, ORG-KR-BGYS, ORG-KR-KVKK, ORG-KR-CEVREISG dahil) ve
// departmanlara (ORG-IV/FB/SA/FN/MH/KL/ST/AS/SS/SG) dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.
//
// VEKALET YOK — bu kurulda hiçbir kutuda vekalet yok.
//
// HİYERARŞİ (3 SEVİYE, kalabalık): P01 (Sistem Sorumlusu, BOŞ) kökün çocuğu;
// P02/P07/P12 (Üretim/Satınalma/Lojistik Sorumlusu) P01'in çocuğu; her birinin
// altında 4'er "MMOG Sorumlusu" kutusu.
//
// Not (unvan tekrarı): P03-P06, P08-P11, P13-P15 kutularının hepsinde name DÜZ
// "MMOG Sorumlusu" — parantezli ayrım (Üretim-1, Satınalma-2 vb.) yalnız EK-A
// kaynağında ve KOD'da var (P03, P04, ...), name'e YAZILMADI. Fabrika seedindeki
// (P27) desenle aynı karar: aynı unvan çok kutuda olsa da rol (Position)
// eşleşmesi düz unvanla tutsun.
// Not (EK-A A.10 "ASSESSMENT YAPMA" satırı): bu bir kutu değil, ayrı bir not —
// seed'e kutu olarak eklenmedi (istenildiği gibi atlandı).

import { PrismaClient, OrgUnitType, OrgPositionStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── NORMALIZE (diğer tüm org seed'lerindeki AYNI fonksiyon) ─────────────

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

// ─── YAPI TANIMI (3 seviye — Üretim/Satınalma/Lojistik kolları) ──────────

interface SeedNode {
  code: string;
  parentCode: string | null;
  unitType: keyof typeof OrgUnitType;
  name: string;
  level: number;
  sortOrder: number;
  approvedHeadcount: number | null;
  employees: string[]; // dolu kutularda isim(ler); BOŞ kadrolarda []
  vekaletDurumu?: boolean;
  vekilAdi?: string; // bu kurulda hiç kullanılmıyor (vekalet yok)
}

const NODES: SeedNode[] = [
  {
    code: "ORG-KR-MMOGLE",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "MMOGLE",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    employees: [],
  },
  {
    code: "ORG-KR-MMOGLE-P01",
    parentCode: "ORG-KR-MMOGLE",
    unitType: "POSITION",
    name: "MMOG Sistem Sorumlusu",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: [], // BOŞ kadro
  },

  // ── Üretim kolu ──────────────────────────────────────────────────────────
  {
    code: "ORG-KR-MMOGLE-P02",
    parentCode: "ORG-KR-MMOGLE-P01",
    unitType: "POSITION",
    name: "MMOG Üretim Sorumlusu",
    level: 2,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Samet Taşlı"],
  },
  {
    code: "ORG-KR-MMOGLE-P03",
    parentCode: "ORG-KR-MMOGLE-P02",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Bedri Güler"],
  },
  {
    code: "ORG-KR-MMOGLE-P04",
    parentCode: "ORG-KR-MMOGLE-P02",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Serdar Uygun"],
  },
  {
    code: "ORG-KR-MMOGLE-P05",
    parentCode: "ORG-KR-MMOGLE-P02",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Kadriye Yıldırım"],
  },
  {
    code: "ORG-KR-MMOGLE-P06",
    parentCode: "ORG-KR-MMOGLE-P02",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Erdem Erdoğan"],
  },

  // ── Satınalma kolu ───────────────────────────────────────────────────────
  {
    code: "ORG-KR-MMOGLE-P07",
    parentCode: "ORG-KR-MMOGLE-P01",
    unitType: "POSITION",
    name: "MMOG Satınalma Sorumlusu",
    level: 2,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Koray İleri"],
  },
  {
    code: "ORG-KR-MMOGLE-P08",
    parentCode: "ORG-KR-MMOGLE-P07",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Ufuk Karabıçak"],
  },
  {
    code: "ORG-KR-MMOGLE-P09",
    parentCode: "ORG-KR-MMOGLE-P07",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Emek Dede"],
  },
  {
    code: "ORG-KR-MMOGLE-P10",
    parentCode: "ORG-KR-MMOGLE-P07",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Faruk Güneş"],
  },
  {
    code: "ORG-KR-MMOGLE-P11",
    parentCode: "ORG-KR-MMOGLE-P07",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: [], // BOŞ kadro
  },

  // ── Lojistik kolu ────────────────────────────────────────────────────────
  {
    code: "ORG-KR-MMOGLE-P12",
    parentCode: "ORG-KR-MMOGLE-P01",
    unitType: "POSITION",
    name: "MMOG Lojistik Sorumlusu",
    level: 2,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Samet Koç"],
  },
  {
    code: "ORG-KR-MMOGLE-P13",
    parentCode: "ORG-KR-MMOGLE-P12",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: [], // BOŞ kadro
  },
  {
    code: "ORG-KR-MMOGLE-P14",
    parentCode: "ORG-KR-MMOGLE-P12",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Erol Turhan"],
  },
  {
    code: "ORG-KR-MMOGLE-P15",
    parentCode: "ORG-KR-MMOGLE-P12",
    unitType: "POSITION",
    name: "MMOG Sorumlusu",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["İsa Boz"],
  },
];

// ─── SORUMLU TABLOSU (yalnız ORG-KR-MMOGLE düğümü, EK-A A.10) ────────────

const SORUMLULUKLAR: { sira: number; birinciSorumlu: string; yedekSorumlu: string | null }[] = [
  { sira: 1, birinciSorumlu: "Sami Tekoğlu", yedekSorumlu: "Ahmet Ozan Çiçek" },
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
  vekalet: string;
}

const gozdenGecir: GozdenGecirEntry[] = [];
const tanimsizRol: TanimsizRolEntry[] = [];
const boxRaporu: BoxReportRow[] = [];

async function main() {
  console.log("F1 — MMOGLE Kurulu pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-KR-MMOGLE / ORG-KR-MMOGLE-* ─────
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-KR-MMOGLE" }, { code: { startsWith: "ORG-KR-MMOGLE-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-KR-MMOGLE* OrgUnit kaydı.\n`);
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

  // ── 3) OrgUnit ağacını kur (parent önce, id map ile) ──
  // Bu kurulda vekalet yok — vekilAdi her zaman null yazılıyor.
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
        isExternal: false,
        positionStatus: OrgPositionStatus.AKTIF,
        positionId,
        vekaletDurumu: node.vekaletDurumu ?? false,
        vekilAdi: node.vekaletDurumu ? node.vekilAdi ?? null : null,
        vekilPersonnelId: null,
      },
    });
    idByCode.set(node.code, created.id);
    orgUnitSayisi++;
  }

  // ── 4) OrgEmployee kayıtları (yalnız dolu kutular) ──────────────────────
  let orgEmployeeSayisi = 0;

  for (const node of NODES) {
    if (node.unitType !== "POSITION") continue;
    const orgUnitId = idByCode.get(node.code)!;
    let m = 0;

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
    orgEmployeeSayisi += m;

    const n = node.approvedHeadcount ?? 0;
    const rozet = m === n ? `Tam ${m}/${n}` : m === 0 ? `Boş 0/${n}` : `Eksik ${m}/${n}`;
    const vekalet = node.vekaletDurumu ? `VEKALET: ${node.vekilAdi}` : "-";
    boxRaporu.push({ kod: node.code, unvan: node.name, n, m, rozet, vekalet });
  }

  // ── 5) OrgBolumMeta + OrgSorumluluk (yalnız ORG-KR-MMOGLE) ──────────────
  const orgKrMmogleId = idByCode.get("ORG-KR-MMOGLE")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgKrMmogleId,
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
        orgUnitId: orgKrMmogleId,
        sira: s.sira,
        birinciSorumlu: s.birinciSorumlu,
        yedekSorumlu: s.yedekSorumlu,
      },
    });
  }

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — MMOGLE Kurulu Pilotu ===\n");
  console.log(`Kurulan OrgUnit sayısı    : ${orgUnitSayisi}`);
  console.log(`Kurulan OrgEmployee sayısı: ${orgEmployeeSayisi}\n`);

  console.log("Kutu bazında durum:");
  console.log("kod              | unvan                                     | N | M | rozet        | vekalet");
  console.log("-".repeat(115));
  for (const r of boxRaporu) {
    console.log(
      `${r.kod.padEnd(16)} | ${r.unvan.padEnd(41)} | ${String(r.n).padEnd(1)} | ${String(r.m).padEnd(1)} | ${r.rozet.padEnd(12)} | ${r.vekalet}`
    );
  }

  console.log("\nGÖZDEN GEÇİR listesi (eşleşmeyen iç personel):");
  if (gozdenGecir.length === 0) {
    console.log("(boş)");
  } else {
    for (const g of gozdenGecir) {
      console.log(`${g.isim} | ${g.kutuKodu} | ${g.etiket}`);
    }
  }

  console.log("\nVekaletler (statik — Personnel'de arama yok):");
  const vekaletKutulari = boxRaporu.filter((r) => r.vekalet !== "-");
  if (vekaletKutulari.length === 0) {
    console.log("(boş)");
  } else {
    for (const v of vekaletKutulari) {
      console.log(`${v.kod} → ${v.vekalet.replace(/^VEKALET: /, "")}`);
    }
  }

  console.log("\nTANIMSIZ ROL listesi:");
  if (tanimsizRol.length === 0) {
    console.log("(boş)");
  } else {
    // TANIMSIZ ROL beklenen davranış: P03-P06/P08-P11/P13-P15 hepsi aynı düz
    // unvanı ("MMOG Sorumlusu") paylaştığı için Position'da o unvan varsa tek
    // eşleşme TÜM bu kutulara uygulanır; yoksa hepsi burada tekilleşmeden listelenir.
    for (const t of tanimsizRol) {
      console.log(`${t.kutuKodu} | ${t.unvan}`);
    }
  }

  console.log("\nBOŞ kadrolar:");
  const bosKadrolar = boxRaporu.filter((r) => r.m === 0);
  if (bosKadrolar.length === 0) {
    console.log("(boş)");
  } else {
    for (const b of bosKadrolar) {
      console.log(`${b.kod} | ${b.unvan}`);
    }
  }

  console.log("\nSorumlu tablosu özeti (ORG-KR-MMOGLE):");
  SORUMLULUKLAR.forEach((s) => {
    console.log(`  ${s.sira} | ${s.birinciSorumlu} | ${s.yedekSorumlu ?? "(yedek yok)"}`);
  });

  console.log("\nF1 MMOGLE Kurulu pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
