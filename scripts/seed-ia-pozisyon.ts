// İş Analizi — IaPozisyon SEED (organizasyon şemasından türetir).
// KAYNAK: OrgUnit unitType='POSITION' ve kodu 'ORG-KR-' ile BAŞLAMAYAN birimler
//         (kurul/komite pozisyonları HARİÇ — birincil-koltuk.ts ile aynı eleme kuralı).
// HEDEF : IaPozisyon { ad = OrgUnit.name, bolum = üst DEPARTMENT adı, yaka = türetilmiş }
//
// IDEMPOTENT: @@unique([ad, bolum]) üzerinden upsert → tekrar çalıştırınca mükerrer üretmez.
// yaka: koltuğu tutan aktif personelin yakaRengi çoğunluğu; yoksa BEYAZ (ofis varsayımı).
// IaYetkinlik'e DOKUNMAZ (ayrı iş).
//
// VARSAYILAN DRY-RUN: --uygula bayrağı YOKSA hiçbir şey yazmaz, yalnız ne yapacağını yazar.
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/seed-ia-pozisyon.ts            # dry-run
//   npx tsx --env-file=.env scripts/seed-ia-pozisyon.ts --uygula   # yazar

import { prisma } from "@/lib/prisma";

const KURUL_KOD_ONEKI = "ORG-KR-";
const MAX_DERINLIK = 15;
const UYGULA = process.argv.includes("--uygula");

type IaYaka = "MAVI" | "BEYAZ" | "GRI";

function dbAdi(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return decodeURIComponent(u.pathname.replace(/^\//, "")).split("?")[0];
  } catch {
    return "(bilinmiyor)";
  }
}

// Birimin kendisi veya üst zincirinde kurul (ORG-KR-) var mı?
async function kurulZincirindeMi(startUnitId: string): Promise<boolean> {
  let currentId: string | null = startUnitId;
  for (let i = 0; i < MAX_DERINLIK; i++) {
    if (!currentId) break;
    const uid: string = currentId;
    const u = await prisma.orgUnit.findUnique({ where: { id: uid }, select: { code: true, parentId: true } });
    if (!u) break;
    if (u.code.startsWith(KURUL_KOD_ONEKI)) return true;
    currentId = u.parentId;
  }
  return false;
}

// Üst zincirdeki ilk DEPARTMENT adı; yoksa en son ulaşılan birim adı; o da yoksa null.
async function bolumBul(startUnitParentId: string | null): Promise<string | null> {
  let currentId: string | null = startUnitParentId;
  let sonAd: string | null = null;
  for (let i = 0; i < MAX_DERINLIK; i++) {
    if (!currentId) break;
    const uid: string = currentId;
    const u = await prisma.orgUnit.findUnique({
      where: { id: uid },
      select: { name: true, parentId: true, unitType: true },
    });
    if (!u) break;
    sonAd = u.name;
    if (u.unitType === "DEPARTMENT") return u.name;
    currentId = u.parentId;
  }
  return sonAd;
}

// Koltuğu tutan aktif personelin yakaRengi çoğunluğu; yoksa BEYAZ.
// OrgEmployee'de Personnel relation'ı YOK (yalnız personnelId skaları) → ayrı sorgu.
async function yakaTuret(orgUnitId: string): Promise<IaYaka> {
  const holders = await prisma.orgEmployee.findMany({
    where: { orgUnitId, isActive: true, personnelId: { not: null } },
    select: { personnelId: true },
  });
  const ids = holders.map((h) => h.personnelId).filter((x): x is string => !!x);
  const sayac: Record<string, number> = {};
  if (ids.length > 0) {
    const personeller = await prisma.personnel.findMany({
      where: { id: { in: ids } },
      select: { yakaRengi: true },
    });
    for (const p of personeller) {
      const y = p.yakaRengi;
      if (y) sayac[y] = (sayac[y] ?? 0) + 1;
    }
  }
  let enCok: IaYaka = "BEYAZ";
  let enCokSayi = 0;
  for (const [y, n] of Object.entries(sayac)) {
    if (n > enCokSayi && (y === "MAVI" || y === "BEYAZ" || y === "GRI")) {
      enCok = y;
      enCokSayi = n;
    }
  }
  return enCok;
}

async function main() {
  const db = dbAdi();
  console.log(`🔌 Hedef DB: ${db}`);
  console.log(`🧪 Mod: ${UYGULA ? "UYGULA (yazacak)" : "DRY-RUN (yazmaz, --uygula ile yazar)"}`);
  console.log("=".repeat(60));

  // Kurul-olmayan tüm POSITION birimleri
  const pozisyonBirimleri = await prisma.orgUnit.findMany({
    where: {
      unitType: "POSITION",
      isActive: true,
      NOT: { code: { startsWith: KURUL_KOD_ONEKI } },
    },
    select: { id: true, code: true, name: true, parentId: true },
    orderBy: { code: "asc" },
  });

  console.log(`POSITION birimi (kurul HARİÇ, aktif): ${pozisyonBirimleri.length}`);

  const planlanan: Array<{ ad: string; bolum: string; yaka: IaYaka; kod: string; islem: "yeni" | "guncel" }> = [];
  let bolumsuzAtlanan = 0;
  let kurulTeyitAtlanan = 0;

  for (const b of pozisyonBirimleri) {
    // Güvenlik: startsWith filtresi kod ön ekini yakalar ama üst zincir de kurula
    // bağlıysa (kod ön eki taşımayan istisna) ele.
    if (await kurulZincirindeMi(b.id)) {
      kurulTeyitAtlanan++;
      continue;
    }
    const bolum = await bolumBul(b.parentId);
    if (!bolum) {
      bolumsuzAtlanan++;
      continue; // bölüm çözülemeyen pozisyon → anlamlı IaPozisyon üretilemez
    }
    const yaka = await yakaTuret(b.id);

    const mevcut = await prisma.iaPozisyon.findUnique({
      where: { ad_bolum: { ad: b.name, bolum } },
      select: { id: true },
    });
    planlanan.push({ ad: b.name, bolum, yaka, kod: b.code, islem: mevcut ? "guncel" : "yeni" });
  }

  const yeni = planlanan.filter((p) => p.islem === "yeni").length;
  const guncel = planlanan.filter((p) => p.islem === "guncel").length;

  console.log(`\nPlanlanan IaPozisyon: ${planlanan.length}  (yeni: ${yeni}, mevcut/güncelleme: ${guncel})`);
  console.log(`Atlanan — bölüm çözülemedi: ${bolumsuzAtlanan}, kurul (zincir teyidi): ${kurulTeyitAtlanan}`);
  console.log(`\nÖrnek ilk 10:`);
  planlanan.slice(0, 10).forEach((p) =>
    console.log(`  [${p.islem === "yeni" ? "+" : "~"}] ${p.kod}  ${p.ad}  ·  bölüm=${p.bolum}  ·  yaka=${p.yaka}`)
  );

  if (!UYGULA) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("💡 DRY-RUN — hiçbir şey yazılmadı. Yazmak için: --uygula");
    return;
  }

  // UYGULA — idempotent upsert (@@unique ad_bolum)
  let yazilan = 0;
  for (const p of planlanan) {
    await prisma.iaPozisyon.upsert({
      where: { ad_bolum: { ad: p.ad, bolum: p.bolum } },
      update: { yaka: p.yaka, aktif: true },
      create: { ad: p.ad, bolum: p.bolum, yaka: p.yaka, aktif: true },
    });
    yazilan++;
  }
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ UYGULANDI — ${yazilan} IaPozisyon upsert edildi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
