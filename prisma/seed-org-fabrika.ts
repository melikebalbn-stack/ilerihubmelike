// prisma/seed-org-fabrika.ts
// F1 — Organizasyon Şeması: Fabrika Müdürlüğü PİLOT verisi (üst+orta katman, operatörsüz)
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-fabrika.ts
//
// İdempotent: her çalıştırmada YALNIZ "ORG-FB" ve "ORG-FB-*" kod uzayı
// temizlenip yeniden kurulur. ORG-IV dahil başka hiçbir bölüme dokunulmaz.
//
// Personnel ve Position tablolarına SADECE OKUMA (findMany) yapılır;
// create/update/delete kesinlikle yok.
//
// Vekalet (P03/P04/P05/P07/P15): vekilAdi STATİK yazılır — Personnel'de arama
// YAPILMAZ, vekilPersonnelId null bırakılır (ileride canlı seçim kancası).
//
// Not (P27): Tabloda "Yurtdışı Müşteri Lojistik Uzmanı (2)" olarak verilmiş —
// "(2)" yalnız P25 ile ayırt etmek için tablo notasyonu; gerçek unvan P25 ile
// birebir aynı ("Yurtdışı Müşteri Lojistik Uzmanı") kabul edildi, rol eşleştirmesi
// buna göre yapıldı (aksi halde normalize sonrası Position ile eşleşmezdi).

import { PrismaClient, OrgUnitType, OrgPositionStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── NORMALIZE (İK seed'indeki AYNI fonksiyon) ───────────────────────────

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
  employees: string[]; // dolu kutularda isim(ler); vekalet/boş kutularda []
  vekaletDurumu?: boolean;
  vekilAdi?: string; // yalnız vekaletDurumu true olan kutularda
}

const NODES: SeedNode[] = [
  {
    code: "ORG-FB",
    parentCode: null,
    unitType: "DEPARTMENT",
    name: "Fabrika Müdürlüğü",
    level: 0,
    sortOrder: 0,
    approvedHeadcount: null,
    employees: [],
  },
  {
    code: "ORG-FB-P01",
    parentCode: "ORG-FB",
    unitType: "POSITION",
    name: "Fabrika Müdürü",
    level: 1,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Samet Taşlı"],
  },
  {
    code: "ORG-FB-P02",
    parentCode: "ORG-FB-P01",
    unitType: "POSITION",
    name: "Fabrika Müdür Yardımcısı / Üretim-Bakım",
    level: 2,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Bedri Güler"],
  },
  {
    code: "ORG-FB-P03",
    parentCode: "ORG-FB-P02",
    unitType: "POSITION",
    name: "Bakım Mühendisi",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: [],
    vekaletDurumu: true,
    vekilAdi: "Bedri Güler",
  },
  {
    code: "ORG-FB-P04",
    parentCode: "ORG-FB-P03",
    unitType: "POSITION",
    name: "Bakımhane Sorumlusu",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: [],
    vekaletDurumu: true,
    vekilAdi: "Rahim Erol",
  },
  {
    code: "ORG-FB-P05",
    parentCode: "ORG-FB-P02",
    unitType: "POSITION",
    name: "Üretim Mühendisi (Kaynakhane)",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: [],
    vekaletDurumu: true,
    vekilAdi: "Bedri Güler",
  },
  {
    code: "ORG-FB-P06",
    parentCode: "ORG-FB-P05",
    unitType: "POSITION",
    name: "Kaynakhane Birim Sorumlusu",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: [], // BOŞ KADRO — vekaletsiz
  },
  {
    code: "ORG-FB-P07",
    parentCode: "ORG-FB-P02",
    unitType: "POSITION",
    name: "Üretim Mühendisi (Montaj-Enjeksiyon)",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: [],
    vekaletDurumu: true,
    vekilAdi: "Bedri Güler",
  },
  {
    code: "ORG-FB-P08",
    parentCode: "ORG-FB-P07",
    unitType: "POSITION",
    name: "Plastik Enjeksiyon & Logo Birim Sorumlusu",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Osman Aslan"],
  },
  {
    code: "ORG-FB-P09",
    parentCode: "ORG-FB-P07",
    unitType: "POSITION",
    name: "Mekanik Montaj Birim Sorumlusu",
    level: 4,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Mustafa Çelik"],
  },
  {
    code: "ORG-FB-P10",
    parentCode: "ORG-FB-P07",
    unitType: "POSITION",
    name: "Paketleme & Direksiyon Birim Sorumlusu",
    level: 4,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Baki Cömert"],
  },
  {
    code: "ORG-FB-P11",
    parentCode: "ORG-FB-P02",
    unitType: "POSITION",
    name: "Üretim Mühendisi (Lazer-Pres-Talaşlı)",
    level: 3,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Erol Şahin"],
  },
  {
    code: "ORG-FB-P12",
    parentCode: "ORG-FB-P11",
    unitType: "POSITION",
    name: "Lazer Daire Testere Birim Sorumlusu",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Özel Çamsoy"],
  },
  {
    code: "ORG-FB-P13",
    parentCode: "ORG-FB-P11",
    unitType: "POSITION",
    name: "Preshane Birim Sorumlusu",
    level: 4,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Orhan Çakmak"],
  },
  {
    code: "ORG-FB-P14",
    parentCode: "ORG-FB-P11",
    unitType: "POSITION",
    name: "Talaşlı İmalat Birim Sorumlusu",
    level: 4,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Tugay Gencer"],
  },
  {
    code: "ORG-FB-P15",
    parentCode: "ORG-FB-P01",
    unitType: "POSITION",
    name: "Fabrika Müdür Yardımcısı / Tedarik Zinciri",
    level: 2,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: [],
    vekaletDurumu: true,
    vekilAdi: "Samet Taşlı",
  },
  {
    code: "ORG-FB-P16",
    parentCode: "ORG-FB-P15",
    unitType: "POSITION",
    name: "Üretim Planlama Sorumlusu",
    level: 3,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Şener Şen"],
  },
  {
    code: "ORG-FB-P17",
    parentCode: "ORG-FB-P16",
    unitType: "POSITION",
    name: "Üretim Planlama Uzmanı",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Ceyhun Selimoğlu"],
  },
  {
    code: "ORG-FB-P18",
    parentCode: "ORG-FB-P16",
    unitType: "POSITION",
    name: "Üretim Planlama Mühendisi",
    level: 4,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Tuğçe Bolat Kargın"],
  },
  {
    code: "ORG-FB-P19",
    parentCode: "ORG-FB-P15",
    unitType: "POSITION",
    name: "İç Lojistik Sorumlusu",
    level: 3,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["Fatih Kaya"],
  },
  {
    code: "ORG-FB-P20",
    parentCode: "ORG-FB-P19",
    unitType: "POSITION",
    name: "Yarı Mamul ve Hammadde Depo Sorumlusu",
    level: 4,
    sortOrder: 0,
    approvedHeadcount: 1,
    employees: ["Onur Ayhan"],
  },
  {
    code: "ORG-FB-P21",
    parentCode: "ORG-FB-P19",
    unitType: "POSITION",
    name: "Mamul Depo Sorumlusu",
    level: 4,
    sortOrder: 1,
    approvedHeadcount: 1,
    employees: ["İsa Boz"],
  },
  {
    code: "ORG-FB-P22",
    parentCode: "ORG-FB-P19",
    unitType: "POSITION",
    name: "Tesellüm Depo Sorumlusu",
    level: 4,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: ["Erol Turhan"],
  },
  {
    code: "ORG-FB-P23",
    parentCode: "ORG-FB-P19",
    unitType: "POSITION",
    name: "Sarf Depo Sorumlusu",
    level: 4,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Fatih Kaya"], // Excel'de böyle: Fatih Kaya P19 + P23'te birlikte — kasıtlı, aynen
  },
  {
    code: "ORG-FB-P24",
    parentCode: "ORG-FB-P15",
    unitType: "POSITION",
    name: "Tedarik Performans ve Risk Uzmanı",
    level: 3,
    sortOrder: 2,
    approvedHeadcount: 1,
    employees: [], // BOŞ KADRO — vekaletsiz
  },
  {
    code: "ORG-FB-P25",
    parentCode: "ORG-FB-P15",
    unitType: "POSITION",
    name: "Yurtdışı Müşteri Lojistik Uzmanı",
    level: 3,
    sortOrder: 3,
    approvedHeadcount: 1,
    employees: ["Gülşah Keskin"],
  },
  {
    code: "ORG-FB-P26",
    parentCode: "ORG-FB-P15",
    unitType: "POSITION",
    name: "Yurtiçi Müşteri Lojistik Uzmanı",
    level: 3,
    sortOrder: 4,
    approvedHeadcount: 1,
    employees: ["Uğur Can Ay"],
  },
  {
    code: "ORG-FB-P27",
    parentCode: "ORG-FB-P15",
    unitType: "POSITION",
    // Not: tabloda "(2)" ile verilmiş, P25 ile aynı gerçek unvan kabul edildi (bkz. dosya başı notu)
    name: "Yurtdışı Müşteri Lojistik Uzmanı",
    level: 3,
    sortOrder: 5,
    approvedHeadcount: 1,
    employees: ["Samet Koç"],
  },
  // ─── Operatör kutuları (P28-P35) — her takım liderinin altına ────────────
  {
    code: "ORG-FB-P28",
    parentCode: "ORG-FB-P09",
    unitType: "POSITION",
    name: "Mekanik Montaj Operatörü",
    level: 5,
    sortOrder: 0,
    approvedHeadcount: 18,
    employees: [
      "Fevzi Karakelle", "Mihriban Yılmaz", "Hanife İzmitlioğlu", "Memiş Şahin", "Erçin Gördük",
      "Sercan Çimşir", "Şenay Demircan", "Esat Turan", "Faysal Ayık", "Cengiz Çetinkaya",
      "Vedat Darlaz", "Hasan Basri Şahin", "Mehmet Bayburtlu", "Adem Bozkurt", "Sevinç Semerci",
      "Hamide Topçu", "Nuray Şentürk", "Ertuğrul Demirel",
    ],
  },
  {
    code: "ORG-FB-P29",
    parentCode: "ORG-FB-P08",
    unitType: "POSITION",
    name: "Enjeksiyon Operatörü",
    level: 5,
    sortOrder: 0,
    approvedHeadcount: 9,
    employees: [
      "İsmail Gündüz", "Aykut Varış", "Sedat Acar", "Kadir Kantemür", "Şenol Avcıoğlu",
      "Muhammet Yaman", "Mehmet Kantemür", "Nevzat Karabulut", "Tarık Yalçın",
    ],
  },
  {
    code: "ORG-FB-P30",
    parentCode: "ORG-FB-P12",
    unitType: "POSITION",
    name: "Lazer/Daire Testere Operatörü",
    level: 5,
    sortOrder: 0,
    approvedHeadcount: 3,
    employees: ["Hüseyin Uysal", "Zeki Karakuş", "Mustafa Çevik"],
  },
  {
    code: "ORG-FB-P31",
    parentCode: "ORG-FB-P14",
    unitType: "POSITION",
    name: "Talaşlı İmalat Operatörü",
    level: 5,
    sortOrder: 0,
    approvedHeadcount: 7,
    employees: [
      "Emirhan Erol", "Ahmet Yağıyanık", "Burhan Ünal", "Orhan Yazgan", "Erdoğan Karadağ",
      "Fatma Topkara", "Selim Bostancıoğlu",
    ],
  },
  {
    code: "ORG-FB-P32",
    parentCode: "ORG-FB-P06",
    unitType: "POSITION",
    name: "Kaynak Operatörü",
    level: 5,
    sortOrder: 0,
    // Not: EK-A'da 26 deniyordu ama verilen listede 22 net isim var — N=22 (liste ile tutarlı, sayı-isim uyumu korundu).
    approvedHeadcount: 22,
    employees: [
      "Selami Kaya", "Murat Yılmaz", "Yener Kösen", "Kenan Kılıç", "Murat Tıngır", "Tunahan Ecer",
      "Yalçın Baran", "Hüsamettin Yavuz", "Erkan Bozuçurum", "Musa Buluç", "Habip Gökalp", "Reyhan Yıldız",
      "İsa Aksu", "Burhan Kaya", "Sevilay Aydın", "Mehmet Önder", "Mevlüt Güleç", "Ayhan Şafakoğlu",
      "Ayhan Aldemir", "Mevlüt Kayran", "Mustafa Karagöz", "Serkan Keleş",
    ],
  },
  {
    code: "ORG-FB-P33",
    parentCode: "ORG-FB-P04",
    unitType: "POSITION",
    name: "Bakım Operatörü",
    level: 5,
    sortOrder: 0,
    approvedHeadcount: 4,
    employees: ["Lütfullah Çakır", "Ahmet Güçlü", "Kemal Aydın", "Oğuz Güller"],
  },
  {
    code: "ORG-FB-P34",
    parentCode: "ORG-FB-P13",
    unitType: "POSITION",
    name: "Preshane Operatörü",
    level: 5,
    sortOrder: 0,
    approvedHeadcount: 4,
    employees: ["Halim Balcı", "Kemal Kızmaz", "Selahattin Karakurt", "Ayhan Akdemir"],
  },
  {
    code: "ORG-FB-P35",
    parentCode: "ORG-FB-P10",
    unitType: "POSITION",
    name: "Paketleme Operatörü",
    level: 5,
    sortOrder: 0,
    approvedHeadcount: 5,
    employees: ["Meral Elmalı", "Nurdane Aktaş", "Cengiz Kahraman", "İsa Çelik", "Ahmet Çiçek"],
  },
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
  console.log("F1 — Fabrika Müdürlüğü pilotu yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-FB / ORG-FB-* kapsamı ──────────
  // Tam eşleşme "ORG-FB" ya da "ORG-FB-" öneki: "ORG-FBX" gibi bir kod
  // yanlışlıkla yakalanmaz (startsWith("ORG-FB") tek başına yakalardı).
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-FB" }, { code: { startsWith: "ORG-FB-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-FB* OrgUnit kaydı.\n`);
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
  // Vekil ismi artık STATİK yazılıyor (vekilAdi) — Personnel'de arama YOK.
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

  // ── 4) OrgEmployee kayıtları (yalnız dolu kutular — vekalet/boş kutularda YOK) ──
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

  // ── 5) OrgBolumMeta (yalnız ORG-FB) — SORUMLU TABLOSU YAZILMIYOR (EK-A'da yok) ──
  const orgFbId = idByCode.get("ORG-FB")!;

  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgFbId,
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

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — Fabrika Müdürlüğü Pilotu ===\n");
  console.log(`Kurulan OrgUnit sayısı    : ${orgUnitSayisi}`);
  console.log(`Kurulan OrgEmployee sayısı: ${orgEmployeeSayisi}\n`);

  console.log("Kutu bazında durum:");
  console.log("kod           | unvan                                        | N | M | rozet        | vekalet");
  console.log("-".repeat(110));
  for (const r of boxRaporu) {
    console.log(
      `${r.kod.padEnd(13)} | ${r.unvan.padEnd(44)} | ${String(r.n).padEnd(1)} | ${String(r.m).padEnd(1)} | ${r.rozet.padEnd(12)} | ${r.vekalet}`
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

  console.log("\nF1 Fabrika Müdürlüğü pilotu tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
