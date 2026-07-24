// prisma/seed-org-kurul-disiplin.ts
// F1 — Organizasyon Şeması: Disiplin Kurulu PİLOT verisi (EK-A A.7)
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-kurul-disiplin.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-KR-DISIPLIN" ve "ORG-KR-DISIPLIN-*"
// kod uzayı temizlenip yeniden kurulur. Diğer kurullara (ORG-KR-IZIN, ORG-KR-ETIK
// dahil) ve departmanlara (ORG-IV/FB/SA/FN/MH/KL/ST/AS/SS/SG) dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.
//
// VEKALET YOK — bu kurulda hiçbir kutuda vekalet yok. BOŞ KADRO YOK — Etik
// Kurulu'ndan farkı: buradaki 3 üye de DOLU.
//
// HİYERARŞİ (Etik Kurulu ile aynı desende — 2 SEVİYE): P01 (Başkan) kökün
// çocuğu, P02 (Başkan Yardımcısı) P01'in çocuğu, P03/P04/P05 (Üyeler) P02'nin
// çocuğu — üyeler yardımcıya bağlı.
//
// Not (P03/P04/P05): aynı unvan "Disiplin Kurulu Üyesi", farklı kod — kaynak
// (EK-A A.7) böyle, rol (Position) eşleşmesi unvan bazlı olduğu için sorun
// yaratmaz.

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

// ─── YAPI TANIMI (2 seviye — üyeler Başkan Yardımcısı'na bağlı) ──────────

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
  vekilAdi?: string; // bu kurulda hiç kullanılmıyor (vekalet yok)
}

const NODES: SeedNode[] = [
  {
    code: "ORG-KR-DISIPLIN",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "Disiplin Kurulu",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    employees: [],
  },
  {
    code: "ORG-KR-DISIPLIN-P01",
    parentCode: "ORG-KR-DISIPLIN",
    unitType: "POSITION",
    name: "Disiplin Kurulu Başkanı",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Halit İleri"],
  },
  {
    code: "ORG-KR-DISIPLIN-P02",
    parentCode: "ORG-KR-DISIPLIN-P01",
    unitType: "POSITION",
    name: "Disiplin Kurulu Başkan Yardımcısı",
    level: 2,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Gürhan Horbay"],
  },
  {
    code: "ORG-KR-DISIPLIN-P03",
    parentCode: "ORG-KR-DISIPLIN-P02",
    unitType: "POSITION",
    name: "Disiplin Kurulu Üyesi",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Elif Kasar"],
  },
  {
    code: "ORG-KR-DISIPLIN-P04",
    parentCode: "ORG-KR-DISIPLIN-P02",
    unitType: "POSITION",
    name: "Disiplin Kurulu Üyesi (2)",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["İlhan Kömürcü"],
  },
  {
    code: "ORG-KR-DISIPLIN-P05",
    parentCode: "ORG-KR-DISIPLIN-P02",
    unitType: "POSITION",
    name: "Disiplin Kurulu Üyesi (3)",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Özel Çamsoy"],
  },
];

// ─── SORUMLU TABLOSU (yalnız ORG-KR-DISIPLIN düğümü, EK-A A.7) ───────────

const SORUMLULUKLAR: { sira: number; birinciSorumlu: string; yedekSorumlu: string | null }[] = [
  { sira: 1, birinciSorumlu: "Halit İleri", yedekSorumlu: "Gürhan Horbay" },
  { sira: 2, birinciSorumlu: "Elif Kasar", yedekSorumlu: null },
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
  console.log("F1 — Disiplin Kurulu pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-KR-DISIPLIN / ORG-KR-DISIPLIN-* ─
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-KR-DISIPLIN" }, { code: { startsWith: "ORG-KR-DISIPLIN-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-KR-DISIPLIN* OrgUnit kaydı.\n`);
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

  // ── 5) OrgBolumMeta + OrgSorumluluk (yalnız ORG-KR-DISIPLIN) ────────────
  const orgKrDisiplinId = idByCode.get("ORG-KR-DISIPLIN")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgKrDisiplinId,
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
        orgUnitId: orgKrDisiplinId,
        sira: s.sira,
        birinciSorumlu: s.birinciSorumlu,
        yedekSorumlu: s.yedekSorumlu,
      },
    });
  }

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — Disiplin Kurulu Pilotu ===\n");
  console.log(`Kurulan OrgUnit sayısı    : ${orgUnitSayisi}`);
  console.log(`Kurulan OrgEmployee sayısı: ${orgEmployeeSayisi}\n`);

  console.log("Kutu bazında durum:");
  console.log("kod                  | unvan                                     | N | M | rozet        | vekalet");
  console.log("-".repeat(120));
  for (const r of boxRaporu) {
    console.log(
      `${r.kod.padEnd(20)} | ${r.unvan.padEnd(41)} | ${String(r.n).padEnd(1)} | ${String(r.m).padEnd(1)} | ${r.rozet.padEnd(12)} | ${r.vekalet}`
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

  console.log("\nSorumlu tablosu özeti (ORG-KR-DISIPLIN):");
  SORUMLULUKLAR.forEach((s) => {
    console.log(`  ${s.sira} | ${s.birinciSorumlu} | ${s.yedekSorumlu ?? "(yedek yok)"}`);
  });

  console.log("\nF1 Disiplin Kurulu pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
