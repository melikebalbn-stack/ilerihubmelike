// prisma/seed-org-tum-firma.ts
// F1 — Organizasyon Şeması: Tüm Firma pozisyon envanteri (EK-A A.1)
//
// ÇALIŞTIRMA (HENÜZ ÇALIŞTIRILMADI — Elif onayı bekliyor):
//   npx tsx prisma/seed-org-tum-firma.ts
//
// PROGRAMATİK TÜRETME — elle yazılmış bir ağaç YOK. Bu seed, 10 departmanın
// (ORG-IV/FB/SA/FN/MH/KL/ST/AS/SS/SG) sandbox DB'sindeki GÜNCEL OrgUnit
// kayıtlarını OKUYUP GM → GMY altında isimsiz, tek birleşik bir pozisyon
// ağacına yeniden kurar. Kaynak departmanlar SADECE OKUNUR (findMany) —
// create/update/delete kesinlikle yok. Yönetim (ORG-YN) ve kurullar (ORG-KR-*)
// bilerek HARİÇ — Yönetim zaten GM/GMY karşılığı, kurullar ayrı bir yapı.
//
// DEPARTMAN KÖK KUTUSU KORUNUR (atlanmaz): GMY → [Departman kutusu, isimsiz
// DEPARTMENT] → departmanın pozisyonları. Bu sayede çok-kök-pozisyonlu
// departmanlar (Satış: Kilit Müşteri + Müdür; Stratejik: 2 müdür) GMY altında
// dağınık kardeşler olarak değil, KENDİ departman kutuları altında gruplu
// görünür. Tek üst pozisyonlu departmanlarda da wrapper aynı şekilde korunur
// (tutarlılık — özel durum yok).
//
// İdempotent: her çalıştırmada YALNIZ "ORG-TF" ve "ORG-TF-*" kod uzayı
// temizlenip yeniden kurulur.
//
// İSİMSİZ ENVANTER (önceki elle yazılmış sürümle aynı karar): hiçbir OrgEmployee
// oluşturulmaz, approvedHeadcount HER kutuda null (rozet/BOŞ KADRO-sarı hiç
// tetiklenmesin — bkz. OrgChartTree.tsx kadroRozeti/isVacantPosition,
// approvedHeadcount tanımsızsa devre dışı), vekaletDurumu=false, vekilAdi=null.
// Kök hariç TÜM kutular unitType=POSITION olarak yazılır — kaynakta GROUP olan
// tek kutu (İK'daki "Danışmanlıklar" G01) dahil, çünkü bu envanterin amacı
// yalnızca pozisyon listesi; departman içi tip ayrımı burada anlamsız.
//
// SORUMLU TABLOSU YOK — bu bir envanter, IV-LS-45 sorumlu tablosu üretmiyor.

import { PrismaClient, OrgUnitType, OrgPositionStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── KAYNAK DEPARTMANLAR (kök kodları) ────────────────────────────────────
// ORG-YN (Yönetim) ve ORG-KR-* (kurullar) bilerek dışarıda.

const KAYNAK_DEPARTMANLAR = [
  "ORG-IV",
  "ORG-FB",
  "ORG-SA",
  "ORG-FN",
  "ORG-MH",
  "ORG-KL",
  "ORG-ST",
  "ORG-AS",
  "ORG-SS",
  "ORG-SG",
];

interface KaynakUnit {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

interface DepartmanRaporu {
  deptCode: string;
  bulunduMu: boolean;
  kaynakPozisyonSayisi: number; // dept kökü hariç
  kopyalananSayisi: number;
  kopyalananIsimler: string[];
}

let kutuSayaci = 0; // ORG-TF-P0001, P0002... global sıra — departmanlar arası benzersizlik garantisi

// Bir departmanın kök kutusunu (isimsiz DEPARTMENT olarak KORUNUR — atlanmaz)
// ve tüm alt kutularını okuyup ORG-TF-GMY altına (göreceli hiyerarşiyi koruyarak)
// kopyalar. Departman kökünün DOĞRUDAN çocukları (departmanın "en üst"
// pozisyon(lar)ı — bazı departmanlarda birden fazla olabilir, ör. Satış'ta
// P01+P02) departman kutusunun ALTINA (GMY'ye değil) kardeş olarak bağlanır.
//
// SIRALAMA: departman kutusunun kendi sortOrder'ı deptIndex (KAYNAK_DEPARTMANLAR
// sırası) — departmanlar GMY altında makul/tutarlı bir sırada dizilir. Departman
// içindeki üst pozisyonlar artık yalnızca KENDİ departman kutuları içinde
// sıralandığından (başka departmanlarla karışma riski yok), kaynaktaki
// sortOrder'ları aynen korunur — ekstra ofset gerekmiyor.
async function departmaniKopyala(
  deptCode: string,
  deptIndex: number,
  gmyId: string,
  gmyLevel: number
): Promise<DepartmanRaporu> {
  const units: KaynakUnit[] = await prisma.orgUnit.findMany({
    where: { OR: [{ code: deptCode }, { code: { startsWith: `${deptCode}-` } }] },
    select: { id: true, code: true, name: true, parentId: true, sortOrder: true },
  });

  const deptRoot = units.find((u) => u.code === deptCode);
  if (!deptRoot) {
    // Departman henüz seed edilmemiş — atla, hata verme (rapor bunu gösterir).
    return { deptCode, bulunduMu: false, kaynakPozisyonSayisi: 0, kopyalananSayisi: 0, kopyalananIsimler: [] };
  }

  // Departman kök kutusu — isimsiz DEPARTMENT, GMY'nin çocuğu.
  kutuSayaci++;
  const deptKutuKodu = `ORG-TF-P${String(kutuSayaci).padStart(4, "0")}`;
  const deptKutu = await prisma.orgUnit.create({
    data: {
      code: deptKutuKodu,
      name: deptRoot.name,
      unitType: OrgUnitType.DEPARTMENT,
      parentId: gmyId,
      level: gmyLevel + 1,
      sortOrder: deptIndex,
      approvedHeadcount: null,
      isExternal: false,
      positionStatus: OrgPositionStatus.AKTIF,
      positionId: null,
      vekaletDurumu: false,
      vekilAdi: null,
      vekilPersonnelId: null,
    },
  });

  const cocuklariByParent = new Map<string, KaynakUnit[]>();
  for (const u of units) {
    if (u.id === deptRoot.id) continue;
    const key = u.parentId ?? "";
    const arr = cocuklariByParent.get(key) ?? [];
    arr.push(u);
    cocuklariByParent.set(key, arr);
  }

  const oldToNewId = new Map<string, string>();
  const oldToNewLevel = new Map<string, number>();
  oldToNewId.set(deptRoot.id, deptKutu.id);
  oldToNewLevel.set(deptRoot.id, deptKutu.level);

  const kopyalananIsimler: string[] = [];
  const kuyruk: KaynakUnit[] = [...(cocuklariByParent.get(deptRoot.id) ?? [])];

  // BFS — parent her zaman child'dan önce işlenir (queue'ya parent işlendikten sonra eklenir).
  while (kuyruk.length > 0) {
    const unit = kuyruk.shift()!;
    const parentNewId = oldToNewId.get(unit.parentId ?? "")!;
    const parentNewLevel = oldToNewLevel.get(unit.parentId ?? "")!;

    kutuSayaci++;
    const yeniKod = `ORG-TF-P${String(kutuSayaci).padStart(4, "0")}`;

    const created = await prisma.orgUnit.create({
      data: {
        code: yeniKod,
        name: unit.name,
        unitType: OrgUnitType.POSITION,
        parentId: parentNewId,
        level: parentNewLevel + 1,
        sortOrder: unit.sortOrder,
        approvedHeadcount: null,
        isExternal: false,
        positionStatus: OrgPositionStatus.AKTIF,
        positionId: null,
        vekaletDurumu: false,
        vekilAdi: null,
        vekilPersonnelId: null,
      },
    });

    oldToNewId.set(unit.id, created.id);
    oldToNewLevel.set(unit.id, parentNewLevel + 1);
    kopyalananIsimler.push(unit.name);

    const cocuklar = cocuklariByParent.get(unit.id) ?? [];
    kuyruk.push(...cocuklar);
  }

  return {
    deptCode,
    bulunduMu: true,
    kaynakPozisyonSayisi: units.length - 1, // dept kökü hariç (pozisyon sayısı — wrapper ayrı sayılır)
    kopyalananSayisi: kopyalananIsimler.length,
    kopyalananIsimler,
  };
}

async function main() {
  console.log("F1 — Tüm Firma pozisyon envanteri PROGRAMATİK TÜRETME ile yükleniyor...\n");

  // ── 1) İDEMPOTENT TEMİZLİK — yalnız ORG-TF / ORG-TF-* kapsamı ──────────
  const mevcut = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-TF" }, { code: { startsWith: "ORG-TF-" } }] },
    select: { id: true },
  });
  const mevcutIds = mevcut.map((u) => u.id);

  if (mevcutIds.length > 0) {
    await prisma.orgEmployee.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgSorumluluk.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgBolumMeta.deleteMany({ where: { orgUnitId: { in: mevcutIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: mevcutIds } } });
    console.log(`Temizlendi: ${mevcutIds.length} eski ORG-TF* OrgUnit kaydı.\n`);
  }

  // ── 2) Kök + GM + GMY ────────────────────────────────────────────────────
  const orgTf = await prisma.orgUnit.create({
    data: {
      code: "ORG-TF",
      name: "İleri Group (Tüm Firma)",
      unitType: OrgUnitType.DEPARTMENT,
      parentId: null,
      level: 0,
      sortOrder: 0,
      approvedHeadcount: null,
      isExternal: false,
      positionStatus: OrgPositionStatus.AKTIF,
      positionId: null,
      vekaletDurumu: false,
      vekilAdi: null,
      vekilPersonnelId: null,
    },
  });

  const orgTfGm = await prisma.orgUnit.create({
    data: {
      code: "ORG-TF-GM",
      name: "Genel Müdür",
      unitType: OrgUnitType.POSITION,
      parentId: orgTf.id,
      level: 1,
      sortOrder: 0,
      approvedHeadcount: null,
      isExternal: false,
      positionStatus: OrgPositionStatus.AKTIF,
      positionId: null,
      vekaletDurumu: false,
      vekilAdi: null,
      vekilPersonnelId: null,
    },
  });

  const orgTfGmy = await prisma.orgUnit.create({
    data: {
      code: "ORG-TF-GMY",
      name: "Genel Müdür Yardımcısı",
      unitType: OrgUnitType.POSITION,
      parentId: orgTfGm.id,
      level: 2,
      sortOrder: 0,
      approvedHeadcount: null,
      isExternal: false,
      positionStatus: OrgPositionStatus.AKTIF,
      positionId: null,
      vekaletDurumu: false,
      vekilAdi: null,
      vekilPersonnelId: null,
    },
  });

  // ── 3) Kaynak departmanları oku ve GMY altına kopyala ───────────────────
  // deptIndex (KAYNAK_DEPARTMANLAR sırası) departman-gruplu sortOrder için kullanılır.
  const departmanRaporlari: DepartmanRaporu[] = [];
  for (let deptIndex = 0; deptIndex < KAYNAK_DEPARTMANLAR.length; deptIndex++) {
    const deptCode = KAYNAK_DEPARTMANLAR[deptIndex];
    const rapor = await departmaniKopyala(deptCode, deptIndex, orgTfGmy.id, orgTfGmy.level);
    departmanRaporlari.push(rapor);
  }

  // ── 4) OrgBolumMeta (yalnız başlık için — sorumlu tablosu YOK) ──────────
  await prisma.orgBolumMeta.create({
    data: {
      orgUnitId: orgTf.id,
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

  // ── 5) Doğrulama — bu seed OrgEmployee OLUŞTURMAZ ve approvedHeadcount hep
  // null olmalı; ikisini de DB'den bizzat sayarak kanıtla (varsayım değil, ölçüm).
  const tumOrgTfKutulari = await prisma.orgUnit.findMany({
    where: { OR: [{ code: "ORG-TF" }, { code: { startsWith: "ORG-TF-" } }] },
    select: { id: true },
  });
  const tumOrgTfIdler = tumOrgTfKutulari.map((u) => u.id);

  const orgEmployeeSayisi = await prisma.orgEmployee.count({
    where: { orgUnitId: { in: tumOrgTfIdler } },
  });
  const headcountDoluSayisi = await prisma.orgUnit.count({
    where: { id: { in: tumOrgTfIdler }, approvedHeadcount: { not: null } },
  });

  // ── 6) RAPOR ─────────────────────────────────────────────────────────────
  console.log("=== F1 SEED RAPORU — Tüm Firma Pozisyon Envanteri (Programatik Türetme) ===\n");
  console.log("Departman bazında kopyalama:");
  console.log("kod     | bulundu mu | kaynak pozisyon | kopyalanan");
  console.log("-".repeat(60));
  for (const r of departmanRaporlari) {
    console.log(
      `${r.deptCode.padEnd(7)} | ${(r.bulunduMu ? "EVET" : "HAYIR — henüz seed edilmemiş").padEnd(10)} | ${String(r.kaynakPozisyonSayisi).padEnd(15)} | ${r.kopyalananSayisi}`
    );
  }

  const toplamKopyalanan = departmanRaporlari.reduce((sum, r) => sum + r.kopyalananSayisi, 0);
  const bulunanDepartmanSayisi = departmanRaporlari.filter((r) => r.bulunduMu).length;
  console.log(
    `\nToplam ORG-TF OrgUnit sayısı: ${tumOrgTfIdler.length} (kök + GM + GMY + ${bulunanDepartmanSayisi} departman kutusu + ${toplamKopyalanan} kopyalanan pozisyon)`
  );
  console.log(`OrgEmployee sayısı: ${orgEmployeeSayisi} (beklenen: 0) — ${orgEmployeeSayisi === 0 ? "GEÇTİ" : "HATA"}`);
  console.log(`approvedHeadcount dolu kutu sayısı: ${headcountDoluSayisi} (beklenen: 0) — ${headcountDoluSayisi === 0 ? "GEÇTİ" : "HATA"}`);

  const sistemGelistirmeRaporu = departmanRaporlari.find((r) => r.deptCode === "ORG-SG");
  console.log("\nÖrnek doğrulama — Sistem Geliştirme (ORG-SG) TÜM pozisyonları Tüm Firma'da var mı:");
  if (!sistemGelistirmeRaporu || !sistemGelistirmeRaporu.bulunduMu) {
    console.log("ORG-SG henüz seed edilmemiş — doğrulama yapılamadı.");
  } else {
    const kontrolIsimleri = ["Grafik Tasarım", "Sistem Geliştirme Müh. - IFS Uzmanı", "IT Uzman Yardımcısı"];
    for (const isim of kontrolIsimleri) {
      const varMi = sistemGelistirmeRaporu.kopyalananIsimler.includes(isim);
      console.log(`  "${isim}": ${varMi ? "VAR" : "YOK — beklenmedik eksik"}`);
    }
  }

  console.log("\nF1 Tüm Firma pozisyon envanteri (programatik türetme) tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
