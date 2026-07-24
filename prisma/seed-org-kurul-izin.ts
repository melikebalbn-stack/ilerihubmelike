// prisma/seed-org-kurul-izin.ts
// F1 — Organizasyon Şeması: İzin Kurulu PİLOT verisi (EK-A A.5)
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-kurul-izin.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-KR-IZIN" ve "ORG-KR-IZIN-*" kod uzayı
// temizlenip yeniden kurulur. Diğer bölüm/kurullara (ORG-IV/ORG-FB/ORG-SA/
// ORG-FN/ORG-MH/ORG-KL/ORG-ST/ORG-AS/ORG-SS/ORG-SG dahil) dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.
//
// VEKALET YOK — bu kurulda hiçbir kutuda vekalet yok.
//
// DÜZ YAPI: İzin Kurulu'nun tüm üyeleri DOĞRUDAN köke (ORG-KR-IZIN) bağlı,
// hiçbiri diğerinin altında değil — kurul üyeleri eşit, hiyerarşi uydurulmadı.
// Hepsi level=1.
//
// Not (P03, 2. İşçi Temsilcisi): EK-A'da isim yok → BOŞ kadro (vekalet DEĞİL).
// Not (P02/P03, P05/P06): aynı unvan farklı kod — kaynak (EK-A A.5) böyle,
// rol (Position) eşleşmesi unvan bazlı olduğu için sorun yaratmaz.

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

// ─── YAPI TANIMI (düz — tüm üyeler kökün doğrudan çocuğu) ────────────────

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
    code: "ORG-KR-IZIN",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "İzin Kurulu",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    employees: [],
  },
  {
    code: "ORG-KR-IZIN-P01",
    parentCode: "ORG-KR-IZIN",
    unitType: "POSITION",
    name: "İzin Kurulu İşveren Temsilcisi",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Elif Kasar"],
  },
  {
    code: "ORG-KR-IZIN-P02",
    parentCode: "ORG-KR-IZIN",
    unitType: "POSITION",
    name: "İzin Kurulu İşçi Temsilcisi",
    level: 1,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Mustafa Çelik"],
  },
  {
    code: "ORG-KR-IZIN-P03",
    parentCode: "ORG-KR-IZIN",
    unitType: "POSITION",
    name: "İzin Kurulu İşçi Temsilcisi (2)",
    level: 1,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: [], // BOŞ kadro
  },
  {
    code: "ORG-KR-IZIN-P04",
    parentCode: "ORG-KR-IZIN",
    unitType: "POSITION",
    name: "Yedek İşveren Temsilcisi",
    level: 1,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Yasemin Çakın"],
  },
  {
    code: "ORG-KR-IZIN-P05",
    parentCode: "ORG-KR-IZIN",
    unitType: "POSITION",
    name: "Yedek İşçi Temsilcisi",
    level: 1,
    sortOrder: 4,
    approvedHeadcount: 1,
    employees: ["Orhan Çakmak"],
  },
  {
    code: "ORG-KR-IZIN-P06",
    parentCode: "ORG-KR-IZIN",
    unitType: "POSITION",
    name: "Yedek İşçi Temsilcisi (2)",
    level: 1,
    sortOrder: 5,
    approvedHeadcount: 1,
    employees: ["Özel Çamsoy"],
  },
];

// ─── SORUMLU TABLOSU (yalnız ORG-KR-IZIN düğümü, EK-A A.5) ───────────────
// Not (3. satır): EK-A'da 1. sorumlu hücresi boştu (yalnız yedek=Orhan Çakmak
// doluydu). birinciSorumlu şemada NOT NULL olduğu için "-" ile temsil edildi.

const SORUMLULUKLAR: { sira: number; birinciSorumlu: string; yedekSorumlu: string | null }[] = [
  { sira: 1, birinciSorumlu: "Elif Kasar", yedekSorumlu: "Yasemin Çakın" },
  { sira: 2, birinciSorumlu: "Mustafa Çelik", yedekSorumlu: "Özel Çamsoy" },
  { sira: 3, birinciSorumlu: "-", yedekSorumlu: "Orhan Çakmak" },
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
  console.log("F1 — İzin Kurulu pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-KR-IZIN / ORG-KR-IZIN-* kapsamı ─
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-KR-IZIN" }, { code: { startsWith: "ORG-KR-IZIN-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-KR-IZIN* OrgUnit kaydı.\n`);
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

  // ── 5) OrgBolumMeta + OrgSorumluluk (yalnız ORG-KR-IZIN) ────────────────
  const orgKrIzinId = idByCode.get("ORG-KR-IZIN")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgKrIzinId,
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
        orgUnitId: orgKrIzinId,
        sira: s.sira,
        birinciSorumlu: s.birinciSorumlu,
        yedekSorumlu: s.yedekSorumlu,
      },
    });
  }

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — İzin Kurulu Pilotu ===\n");
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

  console.log("\nSorumlu tablosu özeti (ORG-KR-IZIN):");
  SORUMLULUKLAR.forEach((s) => {
    console.log(`  ${s.sira} | ${s.birinciSorumlu} | ${s.yedekSorumlu ?? "(yedek yok)"}`);
  });

  console.log("\nF1 İzin Kurulu pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
