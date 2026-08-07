// Org şeması — DEPO operatör pozisyonlarını açar.
//
// NEDEN: Depo ağacında yalnız *Sorumlu* kademesi var (Yarı Mamul / Mamul / Tesellüm /
//   Sarf), operatör kutusu YOK. Diğer tüm üretim birimlerinde desen
//   `<Birim> Birim Sorumlusu → <Birim> Operatörü` şeklinde; depo bu desenin dışında
//   kalmış ve 9 depo operatörünün oturacağı kutu bulunmuyor.
//
// NE YAPAR: her depo sorumlusunun ALTINA bir operatör POSITION'ı açar.
//   ORG-FB-P20 Yarı Mamul ve Hammadde Depo Sorumlusu → Yarı Mamul ve Hammadde Depo Operatörü
//   ORG-FB-P21 Mamul Depo Sorumlusu                  → Mamul Depo Operatörü
//   ORG-FB-P22 Tesellüm Depo Sorumlusu               → Tesellüm Depo Operatörü
//   ORG-FB-P23 Sarf Depo Sorumlusu                   → Sarf Depo Operatörü
//
// ALAN DESENİ mevcut operatör kutularından alınır, uydurulmaz:
//   unitType=POSITION · level=parent.level+1 · sortOrder=0 · isExternal=false
//   positionStatus=AKTIF · vekaletDurumu=false · headcount=0
//   approvedHeadcount = o kutuya oturacak personel sayısı; kimse yoksa 1
//   (boş kutu konvansiyonu — ör. ORG-FB-P03/P05/P15 hepsi approvedHeadcount=1).
//   code = mevcut ORG-FB-P## dizisinin bir sonrakinden devam (veriden okunur).
//
// İDEMPOTENT: aynı ad + aynı parent ile pozisyon zaten varsa yeniden açmaz.
// SİLME YOK. İz: OrgRevizyon (yapan: "Sistem — DEPO_POZISYON").
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/org-depo-operator-pozisyon.ts            # dry-run
//   npx tsx --env-file=.env scripts/org-depo-operator-pozisyon.ts --uygula   # ac

import { prisma } from "@/lib/prisma";
import { orgRevizyonYaz } from "@/lib/org/personel-koltuk-senkron";
import { normalizeAd } from "@/lib/org/koltuk-eslesme";

const UYGULA = process.argv.includes("--uygula");

// Sorumlu kodu → açılacak operatör kutusunun adı + hangi bolumDetay'a karşılık geldiği.
// bolumDetay eşleşmesi approvedHeadcount'u VERİDEN hesaplamak için (kişi sayısı).
const HEDEFLER: { sorumluKodu: string; operatorAdi: string; bolumDetaylari: string[] }[] = [
  {
    sorumluKodu: "ORG-FB-P20",
    operatorAdi: "Yarı Mamul ve Hammadde Depo Operatörü",
    bolumDetaylari: ["YARI MAMÜL", "YARI MAMUL", "HAMMADDE"],
  },
  { sorumluKodu: "ORG-FB-P21", operatorAdi: "Mamul Depo Operatörü", bolumDetaylari: ["MAMUL"] },
  { sorumluKodu: "ORG-FB-P22", operatorAdi: "Tesellüm Depo Operatörü", bolumDetaylari: ["TESELLÜM", "TESELLUM"] },
  { sorumluKodu: "ORG-FB-P23", operatorAdi: "Sarf Depo Operatörü", bolumDetaylari: ["SARF"] },
];

const KOD_ONEKI = "ORG-FB-P";

function dbAdi(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return decodeURIComponent(u.pathname.replace(/^\//, "")).split("?")[0];
  } catch {
    return "(bilinmiyor)";
  }
}

async function main() {
  console.log(`🔌 Hedef DB: ${dbAdi()}`);
  console.log(`🧪 Mod: ${UYGULA ? "UYGULA (pozisyon acilir)" : "DRY-RUN (yalniz listeler)"}`);
  console.log("=".repeat(92));

  // Mevcut ORG-FB-P## dizisinin en büyüğü → yeni kodlar buradan devam eder.
  const fbUnits = await prisma.orgUnit.findMany({
    where: { code: { startsWith: KOD_ONEKI } },
    select: { code: true },
  });
  let sonNo = 0;
  for (const u of fbUnits) {
    const m = u.code.match(/^ORG-FB-P(\d+)$/);
    if (m) sonNo = Math.max(sonNo, parseInt(m[1], 10));
  }
  console.log(`Mevcut en buyuk kod: ${KOD_ONEKI}${sonNo} → yeni kodlar ${KOD_ONEKI}${sonNo + 1}'den devam\n`);

  // Depo personeli — approvedHeadcount'u veriden hesaplamak icin.
  const depoPersonel = await prisma.personnel.findMany({
    where: { aktif: true, bolum: "DEPO" },
    select: { sicilNo: true, adSoyad: true, bolumDetay: true },
  });

  const acilacak: {
    kod: string;
    ad: string;
    parentId: string;
    parentKod: string;
    parentAd: string;
    level: number;
    approvedHeadcount: number;
    kisiler: string[];
  }[] = [];
  const atlanan: { ad: string; sebep: string }[] = [];

  let no = sonNo;
  for (const h of HEDEFLER) {
    const parent = await prisma.orgUnit.findUnique({
      where: { code: h.sorumluKodu },
      select: { id: true, code: true, name: true, level: true },
    });
    if (!parent) {
      atlanan.push({ ad: h.operatorAdi, sebep: `parent bulunamadi (${h.sorumluKodu})` });
      continue;
    }

    // İdempotent: ayni ad + ayni parent zaten varsa acma.
    const kardesler = await prisma.orgUnit.findMany({
      where: { parentId: parent.id },
      select: { code: true, name: true },
    });
    const mevcut = kardesler.find((k) => normalizeAd(k.name) === normalizeAd(h.operatorAdi));
    if (mevcut) {
      atlanan.push({ ad: h.operatorAdi, sebep: `zaten var (${mevcut.code})` });
      continue;
    }

    const kisiler = depoPersonel
      .filter((p) => {
        const bd = normalizeAd(p.bolumDetay ?? "");
        return h.bolumDetaylari.some((x) => normalizeAd(x) === bd);
      })
      .map((p) => `${p.adSoyad} [${p.sicilNo ?? "-"}]`);

    no += 1;
    acilacak.push({
      kod: `${KOD_ONEKI}${no}`,
      ad: h.operatorAdi,
      parentId: parent.id,
      parentKod: parent.code,
      parentAd: parent.name,
      level: parent.level + 1,
      // Boş kutu konvansiyonu: kimse yoksa 1 (mevcut boş kutularla aynı).
      approvedHeadcount: Math.max(1, kisiler.length),
      kisiler,
    });
  }

  console.log(`✅ ACILACAK POZISYON: ${acilacak.length}`);
  for (const a of acilacak) {
    console.log(
      `   ${a.kod.padEnd(12)} ${a.ad.padEnd(40)} lvl:${a.level}  kadro:${a.approvedHeadcount}`,
    );
    console.log(`   ${" ".repeat(12)} └─ parent: ${a.parentKod} ${a.parentAd} (lvl:${a.level - 1})`);
    if (a.kisiler.length > 0) {
      console.log(`   ${" ".repeat(12)}    oturacak: ${a.kisiler.join(", ")}`);
    } else {
      console.log(`   ${" ".repeat(12)}    oturacak: (kimse yok — bos kadro)`);
    }
  }
  if (atlanan.length > 0) {
    console.log(`\n⏭️  ATLANAN: ${atlanan.length}`);
    for (const a of atlanan) console.log(`   · ${a.ad} — ${a.sebep}`);
  }

  console.log(`\n${"=".repeat(92)}`);
  console.log(`ÖZET  acilacak:${acilacak.length}  atlanan:${atlanan.length}`);

  if (!UYGULA) {
    console.log("💡 DRY-RUN — degisiklik yapilmadi. Acmak icin: --uygula");
    console.log("   Sonrasi: scripts/personel-gorev-hizala.ts → scripts/org-koltuk-olustur.ts");
    return;
  }
  if (acilacak.length === 0) {
    console.log("Acilacak pozisyon yok.");
    return;
  }

  console.log(`\nUYGULANIYOR — ${acilacak.length} pozisyon aciliyor...`);
  for (const a of acilacak) {
    await prisma.orgUnit.create({
      data: {
        code: a.kod,
        name: a.ad,
        parentId: a.parentId,
        level: a.level,
        sortOrder: 0,
        unitType: "POSITION",
        headcount: 0,
        approvedHeadcount: a.approvedHeadcount,
        isActive: true,
        isExternal: false,
        positionStatus: "AKTIF",
        vekaletDurumu: false,
      },
    });
    await orgRevizyonYaz(
      prisma,
      a.parentId,
      `Pozisyon açıldı: ${a.ad} (${a.kod}) — ${a.parentAd} altına, kadro ${a.approvedHeadcount}`,
      { sebep: "DEPO_POZISYON" },
    );
    console.log(`   · ${a.kod} ${a.ad} → ${a.parentKod}`);
  }
  console.log("✅ UYGULANDI. Siradaki: scripts/personel-gorev-hizala.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
