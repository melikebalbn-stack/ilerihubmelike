// prisma/seed-org-yonetim.ts
// F1 — Organizasyon Şeması: Yönetim PİLOT verisi (EK-A A.2)
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-yonetim.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-YN" ve "ORG-YN-*" kod uzayı
// temizlenip yeniden kurulur. Diğer departmanlara (ORG-IV/FB/SA/FN/MH/KL/ST/AS/
// SS/SG) ve kurullara (ORG-KR-*) dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.
//
// VEKALET YOK, BOŞ KADRO YOK — bu departmanda tüm kutular dolu.
//
// HİYERARŞİ: P01 (Genel Müdür) kökün çocuğu; P02 (Genel Müdür Yardımcısı —
// Teknik) P01'in çocuğu; P03-P12 (10 müdür/yönetici) P02'nin çocuğu.
//
// Not (EK-A A.2 İngilizce etiketli): kaynak "MANAGEMENT, GENERAL MANAGER..."
// gibi İngilizce başlıklıydı — Türkçe unvan karşılıkları kullanıldı.
// Not (sorumlu tablosu 2. satır): EK-A'da yedek "İlgili Departman Müdürü" —
// belirli bir kişi değil, rol bazlı serbest metin — aynen (metin olarak) korundu.

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
    code: "ORG-YN",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "Yönetim",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    employees: [],
  },
  {
    code: "ORG-YN-P01",
    parentCode: "ORG-YN",
    unitType: "POSITION",
    name: "Genel Müdür",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Halit İleri"],
  },
  {
    code: "ORG-YN-P02",
    parentCode: "ORG-YN-P01",
    unitType: "POSITION",
    name: "Genel Müdür Yardımcısı (Teknik)",
    level: 2,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Gürhan Horbay"],
  },
  {
    code: "ORG-YN-P03",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "Üretim & Planlama Müdürü",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Samet Taşlı"],
  },
  {
    code: "ORG-YN-P04",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "Sistem Geliştirme Müdürü",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["F. Melih Dilben"],
  },
  {
    code: "ORG-YN-P05",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "ARGE / Mühendislik Müdürü",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Orkun Kırçuvaloğlu"],
  },
  {
    code: "ORG-YN-P06",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "Kalite Müdürü",
    level: 3,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Sami Tekoğlu"],
  },
  {
    code: "ORG-YN-P07",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "Satınalma Müdürü",
    level: 3,
    sortOrder: 4,
    approvedHeadcount: 1,
    employees: ["Koray İleri"],
  },
  {
    code: "ORG-YN-P08",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "Satış & Pazarlama Müdürü",
    level: 3,
    sortOrder: 5,
    approvedHeadcount: 1,
    employees: ["Süleyman Işık"],
  },
  {
    code: "ORG-YN-P09",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "İnsan Varlıkları Müdürü",
    level: 3,
    sortOrder: 6,
    approvedHeadcount: 1,
    employees: ["Elif Kasar"],
  },
  {
    code: "ORG-YN-P10",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "Finans-Muhasebe Müdürü",
    level: 3,
    sortOrder: 7,
    approvedHeadcount: 1,
    employees: ["Ebru İleri"],
  },
  {
    code: "ORG-YN-P11",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "Stratejik Sektörler Müdürü",
    level: 3,
    sortOrder: 8,
    approvedHeadcount: 1,
    employees: ["Kadir Koçakoğlu"],
  },
  {
    code: "ORG-YN-P12",
    parentCode: "ORG-YN-P02",
    unitType: "POSITION",
    name: "Stratejik Sektörler Yöneticisi",
    level: 3,
    sortOrder: 9,
    approvedHeadcount: 1,
    employees: ["Eren İleri"],
  },
];

// ─── SORUMLU TABLOSU (yalnız ORG-YN düğümü, EK-A A.2) ────────────────────

const SORUMLULUKLAR: { sira: number; birinciSorumlu: string; yedekSorumlu: string | null }[] = [
  { sira: 1, birinciSorumlu: "Halit İleri", yedekSorumlu: "Gürhan Horbay" },
  { sira: 2, birinciSorumlu: "Gürhan Horbay", yedekSorumlu: "İlgili Departman Müdürü" },
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
  console.log("F1 — Yönetim pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-YN / ORG-YN-* kapsamı ──────────
  // Tam eşleşme "ORG-YN" ya da "ORG-YN-" öneki: "ORG-YNX" gibi bir kod
  // yanlışlıkla yakalanmaz (startsWith("ORG-YN") tek başına yakalardı).
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-YN" }, { code: { startsWith: "ORG-YN-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-YN* OrgUnit kaydı.\n`);
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

  // ── 5) OrgBolumMeta + OrgSorumluluk (yalnız ORG-YN) ─────────────────────
  const orgYnId = idByCode.get("ORG-YN")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgYnId,
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
        orgUnitId: orgYnId,
        sira: s.sira,
        birinciSorumlu: s.birinciSorumlu,
        yedekSorumlu: s.yedekSorumlu,
      },
    });
  }

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — Yönetim Pilotu ===\n");
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

  console.log("\nSorumlu tablosu özeti (ORG-YN):");
  SORUMLULUKLAR.forEach((s) => {
    console.log(`  ${s.sira} | ${s.birinciSorumlu} | ${s.yedekSorumlu ?? "(yedek yok)"}`);
  });

  console.log("\nF1 Yönetim pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
