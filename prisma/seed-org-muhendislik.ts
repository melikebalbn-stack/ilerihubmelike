// prisma/seed-org-muhendislik.ts
// F1 — Organizasyon Şeması: Mühendislik Müdürlüğü PİLOT verisi
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-muhendislik.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-MH" ve "ORG-MH-*" kod uzayı
// temizlenip yeniden kurulur. ORG-IV/ORG-FB/ORG-SA/ORG-FN dahil başka hiçbir
// bölüme dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.
//
// Vekalet (P03): vekilAdi STATİK yazılır — Personnel'de arama YAPILMAZ,
// vekilPersonnelId null bırakılır (ileride canlı seçim kancası) — Satınalma/
// Finans/Fabrika seed'lerindeki güncel mantıkla aynı. EK-A'daki "V.R. Orkun
// Kırçuvaloğlu" ifadesindeki "V.R." vekaleten kısaltmasıdır — vekil=Orkun.
//
// Sorumlu tablosu (EK-A A.19, sadeleştirildi): 3. satırda ham veride
// "Orkun Kırçuvaloğlu V. | İlhan Kömürcü / Haldun Ay" gibi "V." eki ve çift
// yedek vardı — 1. sorumlu="Orkun Kırçuvaloğlu", yedek="İlhan Kömürcü" alındı.

import { PrismaClient, OrgUnitType, OrgPositionStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── NORMALIZE (İK/Fabrika/Satınalma/Finans seed'indeki AYNI fonksiyon) ──

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
  employees: string[]; // dolu kutularda isim(ler); vekalet kutusunda []
  vekaletDurumu?: boolean;
  vekilAdi?: string; // yalnız vekaletDurumu true olan kutuda
}

const NODES: SeedNode[] = [
  {
    code: "ORG-MH",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "Mühendislik Müdürlüğü",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    employees: [],
  },
  {
    code: "ORG-MH-P01",
    parentCode: "ORG-MH",
    unitType: "POSITION",
    name: "Mühendislik Müdürü",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Orkun Kırçuvaloğlu"],
  },
  {
    code: "ORG-MH-P02",
    parentCode: "ORG-MH-P01",
    unitType: "POSITION",
    name: "ARGE Danışmanı",
    level: 2,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["İhsan Ümit Ildır"],
  },
  {
    code: "ORG-MH-P03",
    parentCode: "ORG-MH-P01",
    unitType: "POSITION",
    name: "ARGE Bölüm Sorumlusu",
    level: 2,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: [],
    vekaletDurumu: true,
    vekilAdi: "Orkun Kırçuvaloğlu",
  },
  {
    code: "ORG-MH-P04",
    parentCode: "ORG-MH-P03",
    unitType: "POSITION",
    name: "ARGE Operatörü",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 4,
    employees: ["Haldun Ay", "İlhan Kömürcü", "Veysel Menteşe", "İbrahim Aydemir"],
  },
  {
    code: "ORG-MH-P05",
    parentCode: "ORG-MH-P01",
    unitType: "POSITION",
    name: "Proje Sorumlusu",
    level: 2,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Mehmet Özmen"],
  },
  {
    code: "ORG-MH-P06",
    parentCode: "ORG-MH-P05",
    unitType: "POSITION",
    name: "Proje Sorumlusu",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 3,
    employees: ["Ertaç Çolak", "Mehmet Şahin", "Can Bayram Gülcan"],
  },
  {
    code: "ORG-MH-P07",
    parentCode: "ORG-MH-P05",
    unitType: "POSITION",
    name: "Proje Sistem Uzmanı",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 2,
    employees: ["Hatice Aslan", "Şevval Ertaç"],
  },
  {
    code: "ORG-MH-P08",
    parentCode: "ORG-MH-P05",
    unitType: "POSITION",
    name: "Teknik Ressam",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Ahmet Hacıhaliloğlu"],
  },
  {
    code: "ORG-MH-P09",
    parentCode: "ORG-MH-P01",
    unitType: "POSITION",
    name: "Kalıphane Yöneticisi",
    level: 2,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Muharrem Aygül"],
  },
  {
    code: "ORG-MH-P10",
    parentCode: "ORG-MH-P09",
    unitType: "POSITION",
    name: "Kalıphane Operatörü",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 8,
    employees: [
      "Hamza Köylü", "Ümit Özdemir", "Fatih Osmanoğlu", "Osman Şirin",
      "Mustafa Kaya", "Kemal Şahin", "Gökmen Yılmaz", "Ahmet Sezek",
    ],
  },
];

// ─── SORUMLU TABLOSU (yalnız ORG-MH düğümü, EK-A A.19 — sadeleştirildi) ──

const SORUMLULUKLAR: { sira: number; birinciSorumlu: string; yedekSorumlu: string }[] = [
  { sira: 1, birinciSorumlu: "Orkun Kırçuvaloğlu", yedekSorumlu: "Mehmet Özmen" },
  { sira: 2, birinciSorumlu: "Muharrem Aygül", yedekSorumlu: "Hamza Köylü" },
  { sira: 3, birinciSorumlu: "Orkun Kırçuvaloğlu", yedekSorumlu: "İlhan Kömürcü" },
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
  console.log("F1 — Mühendislik Müdürlüğü pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-MH / ORG-MH-* kapsamı ──────────
  // Tam eşleşme "ORG-MH" ya da "ORG-MH-" öneki: "ORG-MHX" gibi bir kod
  // yanlışlıkla yakalanmaz (startsWith("ORG-MH") tek başına yakalardı).
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-MH" }, { code: { startsWith: "ORG-MH-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-MH* OrgUnit kaydı.\n`);
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
  // Vekil ismi STATİK yazılıyor (vekilAdi) — Personnel'de arama YOK.
  // vekilPersonnelId ileride canlı seçim kancası olarak null bırakılıyor.
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

  // ── 4) OrgEmployee kayıtları (yalnız dolu kutular — vekalet kutusunda YOK) ──
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

  // ── 5) OrgBolumMeta + OrgSorumluluk (yalnız ORG-MH) ─────────────────────
  const orgMhId = idByCode.get("ORG-MH")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgMhId,
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
        orgUnitId: orgMhId,
        sira: s.sira,
        birinciSorumlu: s.birinciSorumlu,
        yedekSorumlu: s.yedekSorumlu,
      },
    });
  }

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — Mühendislik Müdürlüğü Pilotu ===\n");
  console.log(`Kurulan OrgUnit sayısı    : ${orgUnitSayisi}`);
  console.log(`Kurulan OrgEmployee sayısı: ${orgEmployeeSayisi}\n`);

  console.log("Kutu bazında durum:");
  console.log("kod          | unvan                           | N | M | rozet        | vekalet");
  console.log("-".repeat(100));
  for (const r of boxRaporu) {
    console.log(
      `${r.kod.padEnd(12)} | ${r.unvan.padEnd(31)} | ${String(r.n).padEnd(1)} | ${String(r.m).padEnd(1)} | ${r.rozet.padEnd(12)} | ${r.vekalet}`
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

  console.log("\nSorumlu tablosu özeti (ORG-MH):");
  SORUMLULUKLAR.forEach((s) => {
    console.log(`  ${s.sira} | ${s.birinciSorumlu} | ${s.yedekSorumlu}`);
  });

  console.log("\nF1 Mühendislik Müdürlüğü pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
