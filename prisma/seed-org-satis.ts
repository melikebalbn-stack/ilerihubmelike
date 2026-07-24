// prisma/seed-org-satis.ts
// F1 — Organizasyon Şeması: Satış & Pazarlama Müdürlüğü PİLOT verisi (EK-A A.14)
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-satis.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-ST" ve "ORG-ST-*" kod uzayı
// temizlenip yeniden kurulur. ORG-IV/ORG-FB/ORG-SA/ORG-FN/ORG-MH/ORG-KL dahil
// başka hiçbir bölüme dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.
//
// VEKALET YOK — bu departmanda hiçbir kutuda vekalet yok.
//
// Not (P01, Hilmi Ersin İleri): EK-A'da sarı işaretli ama "V." (vekaleten) eki
// yok — vurgu amaçlı, vekalet DEĞİL. NORMAL dolu kutu olarak kuruldu
// (vekaletDurumu=false). Genel Müdür'e bağlı, Satış Müdürü'nün yanında ayrı bir
// kutu olduğu için ORG-ST köküne (P02 ile kardeş) bağlandı.
//
// Not (P08-P11, Bölge Satış Müdürü): parantez içindeki ülke adları kod-ayrımı
// notasyonu DEĞİL, gerçek unvan farkı (bölgeye özel pozisyon) — aynen korundu.

import { PrismaClient, OrgUnitType, OrgPositionStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── NORMALIZE (İK/Fabrika/Satınalma/Finans/Mühendislik/Kalite seed'indeki AYNI fonksiyon) ──

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

interface SeedNode {
  code: string;
  parentCode: string | null;
  unitType: keyof typeof OrgUnitType;
  name: string;
  level: number;
  sortOrder: number;
  approvedHeadcount: number | null;
  employees: string[]; // dolu kutularda isim(ler)
  vekaletDurumu?: boolean;
  vekilAdi?: string; // bu departmanda hiç kullanılmıyor (vekalet yok)
}

const NODES: SeedNode[] = [
  {
    code: "ORG-ST",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "Satış & Pazarlama Müdürlüğü",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    employees: [],
  },
  {
    code: "ORG-ST-P01",
    parentCode: "ORG-ST",
    unitType: "POSITION",
    name: "Kilit Müşteri Yöneticisi - Yeni İş Gel.",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Hilmi Ersin İleri"],
  },
  {
    code: "ORG-ST-P02",
    parentCode: "ORG-ST",
    unitType: "POSITION",
    name: "Satış & Pazarlama Müdürü",
    level: 1,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Süleyman Işık"],
  },
  {
    code: "ORG-ST-P03",
    parentCode: "ORG-ST-P02",
    unitType: "POSITION",
    name: "Satış & Pazarlama Müdür Yardımcısı",
    level: 2,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Erbil Soysal"],
  },
  {
    code: "ORG-ST-P04",
    parentCode: "ORG-ST-P03",
    unitType: "POSITION",
    name: "Maliyet Analiz Sorumlusu",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Ömer Faruk Ünsal"],
  },
  {
    code: "ORG-ST-P05",
    parentCode: "ORG-ST-P04",
    unitType: "POSITION",
    name: "Maliyet Analiz Uzmanı",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Aygül Özgür"],
  },
  {
    code: "ORG-ST-P06",
    parentCode: "ORG-ST-P03",
    unitType: "POSITION",
    name: "Yeni İş Geliştirme Uzmanı",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Onur Kıran"],
  },
  {
    code: "ORG-ST-P07",
    parentCode: "ORG-ST-P03",
    unitType: "POSITION",
    name: "Satış Uzman Yardımcısı",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Azra Şura İleri"],
  },
  {
    code: "ORG-ST-P08",
    parentCode: "ORG-ST-P03",
    unitType: "POSITION",
    name: "Bölge Satış Müdürü (İngiltere)",
    level: 3,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Kemal Öziş"],
  },
  {
    code: "ORG-ST-P09",
    parentCode: "ORG-ST-P03",
    unitType: "POSITION",
    name: "Bölge Satış Müdürü (India)",
    level: 3,
    sortOrder: 4,
    approvedHeadcount: 1,
    employees: ["Sandeep Kumar"],
  },
  {
    code: "ORG-ST-P10",
    parentCode: "ORG-ST-P03",
    unitType: "POSITION",
    name: "Bölge Satış Müdürü (ABD)",
    level: 3,
    sortOrder: 5,
    approvedHeadcount: 1,
    employees: ["Micheal Aust"],
  },
  {
    code: "ORG-ST-P11",
    parentCode: "ORG-ST-P03",
    unitType: "POSITION",
    name: "Bölge Satış Müdürü (Belarus)",
    level: 3,
    sortOrder: 6,
    approvedHeadcount: 1,
    employees: ["Ruslan Rudakoiski"],
  },
];

// ─── SORUMLU TABLOSU (yalnız ORG-ST düğümü, EK-A A.14) ───────────────────

const SORUMLULUKLAR: { sira: number; birinciSorumlu: string; yedekSorumlu: string }[] = [
  { sira: 1, birinciSorumlu: "Süleyman Işık", yedekSorumlu: "Erbil Soysal" },
  { sira: 2, birinciSorumlu: "Erbil Soysal", yedekSorumlu: "Süleyman Işık" },
  { sira: 3, birinciSorumlu: "Hilmi İleri", yedekSorumlu: "Süleyman Işık" },
  { sira: 4, birinciSorumlu: "Ömer Faruk Ünsal", yedekSorumlu: "Aygül Özgür" },
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
  console.log("F1 — Satış & Pazarlama Müdürlüğü pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-ST / ORG-ST-* kapsamı ──────────
  // Tam eşleşme "ORG-ST" ya da "ORG-ST-" öneki: "ORG-STX" gibi bir kod
  // yanlışlıkla yakalanmaz (startsWith("ORG-ST") tek başına yakalardı).
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-ST" }, { code: { startsWith: "ORG-ST-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-ST* OrgUnit kaydı.\n`);
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
  // Bu departmanda vekalet yok — vekilAdi her zaman null yazılıyor.
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

  // ── 5) OrgBolumMeta + OrgSorumluluk (yalnız ORG-ST) ─────────────────────
  const orgStId = idByCode.get("ORG-ST")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgStId,
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
        orgUnitId: orgStId,
        sira: s.sira,
        birinciSorumlu: s.birinciSorumlu,
        yedekSorumlu: s.yedekSorumlu,
      },
    });
  }

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — Satış & Pazarlama Müdürlüğü Pilotu ===\n");
  console.log(`Kurulan OrgUnit sayısı    : ${orgUnitSayisi}`);
  console.log(`Kurulan OrgEmployee sayısı: ${orgEmployeeSayisi}\n`);

  console.log("Kutu bazında durum:");
  console.log("kod          | unvan                                     | N | M | rozet        | vekalet");
  console.log("-".repeat(110));
  for (const r of boxRaporu) {
    console.log(
      `${r.kod.padEnd(12)} | ${r.unvan.padEnd(41)} | ${String(r.n).padEnd(1)} | ${String(r.m).padEnd(1)} | ${r.rozet.padEnd(12)} | ${r.vekalet}`
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
    for (const t of tanimsizRol) {
      console.log(`${t.kutuKodu} | ${t.unvan}`);
    }
  }

  console.log("\nSorumlu tablosu özeti (ORG-ST):");
  SORUMLULUKLAR.forEach((s) => {
    console.log(`  ${s.sira} | ${s.birinciSorumlu} | ${s.yedekSorumlu}`);
  });

  console.log("\nF1 Satış & Pazarlama Müdürlüğü pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
