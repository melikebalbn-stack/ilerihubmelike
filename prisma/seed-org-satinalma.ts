// prisma/seed-org-satinalma.ts
// F1 — Organizasyon Şeması: Satınalma Müdürlüğü PİLOT verisi
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-satinalma.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-SA" ve "ORG-SA-*" kod uzayı
// temizlenip yeniden kurulur. ORG-IV/ORG-FB dahil başka hiçbir bölüme dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.
//
// Vekalet (P02): vekilAdi STATİK yazılır — Personnel'de arama YAPILMAZ,
// vekilPersonnelId null bırakılır (ileride canlı seçim kancası) — Fabrika
// seed'indeki güncel mantıkla aynı.

import { PrismaClient, OrgUnitType, OrgPositionStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── NORMALIZE (İK/Fabrika seed'indeki AYNI fonksiyon) ───────────────────

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
    code: "ORG-SA",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "Satınalma Müdürlüğü",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    employees: [],
  },
  {
    code: "ORG-SA-P01",
    parentCode: "ORG-SA",
    unitType: "POSITION",
    name: "Satınalma Müdürü",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Koray İleri"],
  },
  {
    code: "ORG-SA-P02",
    parentCode: "ORG-SA-P01",
    unitType: "POSITION",
    name: "Hammadde Satınalma Uzmanı",
    level: 2,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: [],
    vekaletDurumu: true,
    vekilAdi: "Koray İleri",
  },
  {
    code: "ORG-SA-P03",
    parentCode: "ORG-SA-P01",
    unitType: "POSITION",
    name: "Proje Satınalma Uzmanı",
    level: 2,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["İbrahim Bozkurt"],
  },
  {
    code: "ORG-SA-P04",
    parentCode: "ORG-SA-P01",
    unitType: "POSITION",
    name: "Hizmet Satınalma Uzmanı",
    level: 2,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Ufuk Karabıçak"],
  },
  {
    code: "ORG-SA-P05",
    parentCode: "ORG-SA-P01",
    unitType: "POSITION",
    name: "Satınalma Uzmanı",
    level: 2,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Emek Dede"],
  },
  {
    code: "ORG-SA-P06",
    parentCode: "ORG-SA-P01",
    unitType: "POSITION",
    name: "Tedarikçi İş Geliştirme Uzmanı",
    level: 2,
    sortOrder: 4,
    approvedHeadcount: 1,
    employees: ["Faruk Güneş"],
  },
  {
    code: "ORG-SA-P07",
    parentCode: "ORG-SA-P01",
    unitType: "POSITION",
    name: "Satın Alma Uzmanı",
    level: 2,
    sortOrder: 5,
    approvedHeadcount: 1,
    employees: ["Emrah Çankaya"],
  },
];

// ─── SORUMLU TABLOSU (yalnız ORG-SA düğümü) ──────────────────────────────

const SORUMLULUKLAR: { sira: number; birinciSorumlu: string; yedekSorumlu: string }[] = [
  { sira: 1, birinciSorumlu: "Koray İleri", yedekSorumlu: "Ufuk Karabıçak" },
  { sira: 2, birinciSorumlu: "Ufuk Karabıçak", yedekSorumlu: "Faruk Güneş" },
  { sira: 3, birinciSorumlu: "Faruk Güneş", yedekSorumlu: "Ufuk Karabıçak" },
  { sira: 4, birinciSorumlu: "Emek Dede", yedekSorumlu: "İbrahim Bozkurt" },
  { sira: 5, birinciSorumlu: "Emrah Çankaya", yedekSorumlu: "Emek Dede" },
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
  console.log("F1 — Satınalma Müdürlüğü pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-SA / ORG-SA-* kapsamı ──────────
  // Tam eşleşme "ORG-SA" ya da "ORG-SA-" öneki: "ORG-SAX" gibi bir kod
  // yanlışlıkla yakalanmaz (startsWith("ORG-SA") tek başına yakalardı).
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-SA" }, { code: { startsWith: "ORG-SA-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-SA* OrgUnit kaydı.\n`);
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

  // ── 5) OrgBolumMeta + OrgSorumluluk (yalnız ORG-SA) ─────────────────────
  const orgSaId = idByCode.get("ORG-SA")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgSaId,
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
        orgUnitId: orgSaId,
        sira: s.sira,
        birinciSorumlu: s.birinciSorumlu,
        yedekSorumlu: s.yedekSorumlu,
      },
    });
  }

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — Satınalma Müdürlüğü Pilotu ===\n");
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

  console.log("\nSorumlu tablosu özeti (ORG-SA):");
  SORUMLULUKLAR.forEach((s) => {
    console.log(`  ${s.sira} | ${s.birinciSorumlu} | ${s.yedekSorumlu}`);
  });

  console.log("\nF1 Satınalma Müdürlüğü pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
