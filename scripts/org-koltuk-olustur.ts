// Org şeması — KOLTUKSUZ aktif personel için koltuk açma.
//
// Aktif olup org şemasında hiç açık koltuğu olmayan personeli bulur ve
// src/lib/org/koltuk-eslesme.ts (TEK KAYNAK) ile pozisyon eşleştirmesi yapar.
//
// GÜVENLİK
//   - VARSAYILAN DRY-RUN. --uygula olmadan yazmaz.
//   - Yalnız TEK KESİN eşleşmede koltuk açılır; belirsizlikte AÇILMAZ, raporlanır.
//   - Kurul (ORG-KR-*) koltuğu açılmaz — eşleştirme kuralı zaten dışlar.
//   - Yeni OrgUnit (pozisyon) OLUŞTURULMAZ; unvan tanımlı değilse raporlanır.
//   - Aynı eşleştirme otomatik senkronda da kullanılır (personelEklendiginde),
//     böylece elle çalıştırma ile otomatik akış aynı sonucu verir.
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/org-koltuk-olustur.ts            # dry-run
//   npx tsx --env-file=.env scripts/org-koltuk-olustur.ts --uygula   # koltuklari ac

import { prisma } from "@/lib/prisma";
import { eslesmeIndeksiYukle, pozisyonEslesmesiBul } from "@/lib/org/koltuk-eslesme";
import { koltukAc } from "@/lib/org/personel-koltuk-senkron";

const UYGULA = process.argv.includes("--uygula");

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
  console.log(`🧪 Mod: ${UYGULA ? "UYGULA (koltuk acilir)" : "DRY-RUN (yalniz listeler)"}`);
  console.log("=".repeat(96));

  const aktifler = await prisma.personnel.findMany({
    where: { aktif: true },
    select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true },
    orderBy: [{ bolum: "asc" }, { adSoyad: "asc" }],
  });
  const koltuklu = await prisma.orgEmployee.findMany({
    where: { isActive: true, personnelId: { not: null } },
    select: { personnelId: true },
  });
  const koltukluSet = new Set(koltuklu.map((k) => k.personnelId!));
  const koltuksuz = aktifler.filter((p) => !koltukluSet.has(p.id));

  console.log(`\nAktif personel: ${aktifler.length} · koltuklu: ${koltukluSet.size} · KOLTUKSUZ: ${koltuksuz.length}\n`);

  const ix = await eslesmeIndeksiYukle();

  const acilacak: { p: (typeof koltuksuz)[number]; orgUnitId: string; code: string; name: string }[] = [];
  const eslesmeyen: { p: (typeof koltuksuz)[number]; sebep: string; adaylar: string[] }[] = [];

  for (const p of koltuksuz) {
    const r = pozisyonEslesmesiBul(ix, { bolum: p.bolum, gorev: p.gorev });
    if (r.eslesti) {
      acilacak.push({ p, orgUnitId: r.orgUnitId, code: r.code, name: r.name });
    } else {
      eslesmeyen.push({ p, sebep: r.sebep, adaylar: r.adaylar.map((a) => `${a.code} ${a.name}`) });
    }
  }

  console.log(`✅ KOLTUK ACILACAK: ${acilacak.length}`);
  if (acilacak.length > 0) {
    console.log(`   ${"SİCİL".padEnd(11)} ${"AD SOYAD".padEnd(26)} ${"BÖLÜM".padEnd(24)} ${"→ POZİSYON".padEnd(34)} KOD`);
    for (const a of acilacak) {
      console.log(
        `   ${(a.p.sicilNo ?? "-").padEnd(11)} ${a.p.adSoyad.slice(0, 26).padEnd(26)} ` +
          `${a.p.bolum.slice(0, 24).padEnd(24)} ${a.name.slice(0, 34).padEnd(34)} ${a.code}`,
      );
    }
  }

  console.log(`\n⏭️  ESLESMEYEN: ${eslesmeyen.length} (koltuk ACILMAZ)`);
  const sebepGrup = new Map<string, number>();
  for (const e of eslesmeyen) {
    const anahtar = e.sebep.split(" (")[0];
    sebepGrup.set(anahtar, (sebepGrup.get(anahtar) ?? 0) + 1);
  }
  for (const [s, n] of [...sebepGrup].sort((x, y) => y[1] - x[1])) {
    console.log(`   · ${s}: ${n}`);
  }
  if (eslesmeyen.length > 0) {
    console.log(`\n   ${"SİCİL".padEnd(11)} ${"AD SOYAD".padEnd(26)} ${"BÖLÜM".padEnd(24)} ${"GÖREV".padEnd(34)} SEBEP`);
    for (const e of eslesmeyen) {
      console.log(
        `   ${(e.p.sicilNo ?? "-").padEnd(11)} ${e.p.adSoyad.slice(0, 26).padEnd(26)} ` +
          `${e.p.bolum.slice(0, 24).padEnd(24)} ${e.p.gorev.slice(0, 34).padEnd(34)} ${e.sebep}`,
      );
      if (e.adaylar.length > 0) {
        for (const a of e.adaylar.slice(0, 4)) console.log(`   ${" ".repeat(11)} aday: ${a}`);
      }
    }
  }

  console.log(`\n${"=".repeat(96)}`);
  console.log(`ÖZET  koltuksuz:${koltuksuz.length}  acilacak:${acilacak.length}  eslesmeyen:${eslesmeyen.length}`);

  if (!UYGULA) {
    console.log("💡 DRY-RUN — degisiklik yapilmadi. Acmak icin: --uygula");
    console.log("   Eslesmeyenler İK tarafından org semasindan ELLE baglanmali");
    console.log("   (uyari: /strategic-hr/org-chart · 'Semada yeri olmayan personel').");
    return;
  }
  if (acilacak.length === 0) {
    console.log("Acilacak koltuk yok.");
    return;
  }

  console.log(`\nUYGULANIYOR — ${acilacak.length} koltuk aciliyor...`);
  for (const a of acilacak) {
    await koltukAc(
      prisma,
      { personnelId: a.p.id, orgUnitId: a.orgUnitId, displayName: a.p.adSoyad },
      { sebep: "KOLTUK_TAMAMLAMA" },
    );
    console.log(`   · ${a.p.adSoyad} → ${a.name} (${a.code})`);
  }
  console.log("✅ UYGULANDI.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
