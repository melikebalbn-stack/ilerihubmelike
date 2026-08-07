// Org şeması — koltuk/personel tutarlılık kontrolü. ÜÇ YÖN tarar:
//
//   1) İLERİ  — pasif personel + AÇIK koltuk (klasik sarkma) + pasif vekil
//   2) TERS   — aktif personel + KAPALI koltuk (çıkış→geri alma döngüsünde koltuk
//               yeniden açılmamış). Senkron simetrisi personelAktiflestiginde ile
//               kapatıldı; bu bölüm eski kayıtları ve kaçakları yakalar.
//   3) BAĞSIZ — OrgEmployee.personnelId = NULL olan AÇIK koltuklar. KÖR NOKTA:
//               1 ve 2 personnelId üzerinden JOIN yaptığı için bu koltuklar onlara
//               yapısal olarak görünmez. displayName ile Personnel'de karşılığı
//               aranır; karşılığı PASİF olan koltuk gerçek sarkmadır.
//               Onarım (bağ kurma): scripts/org-koltuk-personel-baglama.ts
//
// VARSAYILAN DRY-RUN: yalnız listeler. --uygula YALNIZ 1. yöndeki sarkmayı temizler
//   (koltuk kapat + vekalet kaldır, personel-koltuk-senkron helper'ı üzerinden —
//   SİLME YOK). 2 ve 3 rapor amaçlıdır, --uygula onlara dokunmaz.
// Prod-guard DEĞİL (bilinçli çalıştırılır) ama hangi DB'ye bağlandığını yazar.
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/org-pasif-sarkma-kontrol.ts            # dry-run
//   npx tsx --env-file=.env scripts/org-pasif-sarkma-kontrol.ts --uygula   # temizle

import { prisma } from "@/lib/prisma";
import { personelPasiflestiginde } from "@/lib/org/personel-koltuk-senkron";

const UYGULA = process.argv.includes("--uygula");

// prisma/seed-org-*.ts ve org-koltuk-personel-baglama.ts ile AYNI normalize.
const DIACRITIC_MAP: Record<string, string> = { Ç: "C", Ğ: "G", Ş: "S", Ö: "O", Ü: "U", İ: "I" };

function normalize(input: string): string {
  if (!input) return "";
  let s = input.toLocaleUpperCase("tr-TR");
  s = s.replace(/[ÇĞŞÖÜİ]/g, (ch) => DIACRITIC_MAP[ch] ?? ch);
  s = s.replace(/^DR\.?\s+/, "");
  s = s.replace(/\s+V\.?$/, "");
  s = s.replace(/[^A-Z0-9]+/g, " ");
  return s.trim().replace(/\s+/g, " ");
}

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
  console.log(`🧪 Mod: ${UYGULA ? "UYGULA (koltuk kapat + vekalet kaldır)" : "DRY-RUN (yalnız listeler)"}`);
  console.log("=".repeat(60));

  // 1) Sarkan koltuklar: OrgEmployee.isActive=true + bağlı Personnel.aktif=false
  const aktifKoltuklar = await prisma.orgEmployee.findMany({
    where: { isActive: true, personnelId: { not: null } },
    select: { id: true, displayName: true, personnelId: true, orgUnit: { select: { name: true, code: true } } },
  });
  const koltukPids = Array.from(new Set(aktifKoltuklar.map((k) => k.personnelId).filter((x): x is string => !!x)));
  const pasifPersonel = new Map<string, string>(); // id → adSoyad
  if (koltukPids.length > 0) {
    const ps = await prisma.personnel.findMany({
      where: { id: { in: koltukPids }, aktif: false },
      select: { id: true, adSoyad: true },
    });
    for (const p of ps) pasifPersonel.set(p.id, p.adSoyad);
  }
  const sarkanKoltuklar = aktifKoltuklar.filter((k) => k.personnelId && pasifPersonel.has(k.personnelId));

  // 2) Sarkan vekaletler: OrgUnit.vekilPersonnelId pasif bir kişiye işaret ediyor
  const vekaletler = await prisma.orgUnit.findMany({
    where: { vekilPersonnelId: { not: null } },
    select: { id: true, name: true, code: true, vekilPersonnelId: true, vekilAdi: true },
  });
  const vekilPids = Array.from(new Set(vekaletler.map((v) => v.vekilPersonnelId).filter((x): x is string => !!x)));
  const pasifVekil = new Set<string>();
  if (vekilPids.length > 0) {
    const ps = await prisma.personnel.findMany({
      where: { id: { in: vekilPids }, aktif: false },
      select: { id: true },
    });
    for (const p of ps) pasifVekil.add(p.id);
  }
  const sarkanVekaletler = vekaletler.filter((v) => v.vekilPersonnelId && pasifVekil.has(v.vekilPersonnelId));

  console.log(`\n── YÖN 1: İLERİ ──────────────────────────────────────────────`);
  console.log(`1a) Sarkan KOLTUK (pasif personel + aktif koltuk): ${sarkanKoltuklar.length}`);
  sarkanKoltuklar.forEach((k) =>
    console.log(`   · ${k.displayName} — ${k.orgUnit?.name ?? "?"} (${k.orgUnit?.code ?? "?"}) [personnelId=${k.personnelId}]`)
  );
  console.log(`\n1b) Sarkan VEKALET (pasif kişi hâlâ vekil): ${sarkanVekaletler.length}`);
  sarkanVekaletler.forEach((v) =>
    console.log(`   · ${v.vekilAdi ?? "?"} → ${v.name} (${v.code}) [vekilPersonnelId=${v.vekilPersonnelId}]`)
  );

  // ── YÖN 2: TERS — aktif personel ama koltuğu KAPALI ──────────────────────
  // Çıkış → aktife geri alma döngüsünde koltuk yeniden açılmamışsa buraya düşer.
  const kapaliKoltuklar = await prisma.orgEmployee.findMany({
    where: { isActive: false, personnelId: { not: null } },
    select: { id: true, displayName: true, personnelId: true, updatedAt: true, orgUnit: { select: { name: true, code: true } } },
  });
  const kapaliPids = Array.from(new Set(kapaliKoltuklar.map((k) => k.personnelId).filter((x): x is string => !!x)));
  const aktifPersonel = new Map<string, string>();
  if (kapaliPids.length > 0) {
    const ps = await prisma.personnel.findMany({
      where: { id: { in: kapaliPids }, aktif: true },
      select: { id: true, adSoyad: true, sicilNo: true },
    });
    for (const p of ps) aktifPersonel.set(p.id, `${p.adSoyad} [${p.sicilNo ?? "sicilsiz"}]`);
  }
  const tersSarkma = kapaliKoltuklar.filter((k) => k.personnelId && aktifPersonel.has(k.personnelId));

  console.log(`\n── YÖN 2: TERS ───────────────────────────────────────────────`);
  console.log(`2) Aktif personel ama KAPALI koltuk: ${tersSarkma.length}`);
  tersSarkma.forEach((k) =>
    console.log(
      `   · ${aktifPersonel.get(k.personnelId!)} — ${k.orgUnit?.name ?? "?"} (${k.orgUnit?.code ?? "?"}) ` +
        `[kapanma: ${k.updatedAt.toISOString().slice(0, 10)}]`
    )
  );
  if (tersSarkma.length > 0) {
    console.log(`   ⚠️  Koltuk elle açılmalı ya da personel yeniden aktifleştirilmeli`);
    console.log(`      (aktife alma artık personelAktiflestiginde ile koltuğu kendiliğinden açar).`);
  }

  // ── YÖN 3: BAĞSIZ KOLTUK — kör nokta taraması ────────────────────────────
  const bagsizKoltuklar = await prisma.orgEmployee.findMany({
    where: { personnelId: null, isActive: true },
    select: { id: true, displayName: true, orgUnit: { select: { name: true, code: true } } },
    orderBy: { displayName: "asc" },
  });
  const tumPersonel = await prisma.personnel.findMany({
    select: { id: true, adSoyad: true, sicilNo: true, aktif: true },
  });
  const isimHaritasi = new Map<string, { adSoyad: string; sicilNo: string | null; aktif: boolean }[]>();
  for (const p of tumPersonel) {
    const key = normalize(p.adSoyad);
    if (!key) continue;
    const arr = isimHaritasi.get(key) ?? [];
    arr.push(p);
    isimHaritasi.set(key, arr);
  }

  // Mükerrer/ikinci ad kuralı — org-koltuk-personel-baglama.ts ile AYNI:
  // "KORAY ILERI" ⊂ "KORAY MERT ILERI" (aktif) ise tek eşleşme olsa da belirsizdir.
  const normluPersonel = tumPersonel.map((p) => ({ p, tok: normalize(p.adSoyad).split(" ").filter(Boolean) }));
  const strictUstKume = (a: string[], b: string[]): boolean => {
    if (b.length <= a.length) return false;
    const havuz = [...b];
    for (const t of a) {
      const i = havuz.indexOf(t);
      if (i === -1) return false;
      havuz.splice(i, 1);
    }
    return true;
  };

  const bagsizPasif: typeof bagsizKoltuklar = [];
  const bagsizAktif: typeof bagsizKoltuklar = [];
  const bagsizKayitsiz: typeof bagsizKoltuklar = [];
  const bagsizBelirsiz: typeof bagsizKoltuklar = [];
  for (const k of bagsizKoltuklar) {
    const norm = normalize(k.displayName);
    const eslesen = isimHaritasi.get(norm) ?? [];
    const tok = norm.split(" ").filter(Boolean);
    const aktifUzunSurum = normluPersonel.some(({ p, tok: pt }) => p.aktif && strictUstKume(tok, pt));
    if (eslesen.length === 0) bagsizKayitsiz.push(k);
    else if (eslesen.length > 1 || aktifUzunSurum) bagsizBelirsiz.push(k);
    else if (eslesen[0].aktif) bagsizAktif.push(k);
    else bagsizPasif.push(k);
  }

  console.log(`\n── YÖN 3: BAĞSIZ KOLTUK (kör nokta) ──────────────────────────`);
  console.log(`3) personnelId = NULL olan aktif koltuk: ${bagsizKoltuklar.length}`);
  console.log(`   · karşılığı PASİF personel  : ${bagsizPasif.length}  ← GİZLİ SARKMA`);
  console.log(`   · karşılığı AKTİF personel  : ${bagsizAktif.length}  (yalnız bağ eksik)`);
  console.log(`   · personel kaydı yok        : ${bagsizKayitsiz.length}  (dış danışman / ünvan / placeholder)`);
  console.log(`   · belirsiz / mükerrer şüphesi: ${bagsizBelirsiz.length}  (elle karar — bağlanmaz)`);
  if (bagsizBelirsiz.length > 0) {
    for (const k of bagsizBelirsiz) {
      console.log(`      ⚠️  ${(k.orgUnit?.code ?? "?").padEnd(20)} ${(k.orgUnit?.name ?? "?").slice(0, 32).padEnd(32)} "${k.displayName}"`);
    }
  }
  if (bagsizPasif.length > 0) {
    console.log(`\n   🚨 GİZLİ SARKMA — çıkmış personel hâlâ şemada dolu koltukta:`);
    for (const k of bagsizPasif) {
      const p = (isimHaritasi.get(normalize(k.displayName)) ?? [])[0];
      console.log(
        `      ${(k.orgUnit?.code ?? "?").padEnd(20)} ${(k.orgUnit?.name ?? "?").slice(0, 32).padEnd(32)} ` +
          `${k.displayName} [${p?.sicilNo ?? "sicilsiz"}]`
      );
    }
    console.log(`\n   → Onarım: npx tsx --env-file=.env scripts/org-koltuk-personel-baglama.ts --uygula`);
    console.log(`     ardından bu script'i --uygula ile tekrar çalıştır.`);
  }

  console.log(`\n${"=".repeat(62)}`);
  console.log(`ÖZET  ileri:${sarkanKoltuklar.length} vekalet:${sarkanVekaletler.length} ters:${tersSarkma.length} gizli:${bagsizPasif.length}`);

  if (!UYGULA) {
    console.log("💡 DRY-RUN — değişiklik yapılmadı. Kapatmak için: --uygula");
    console.log("   (--uygula YALNIZ yön 1'i temizler; yön 2 ve 3 rapor amaçlıdır.)");
    return;
  }

  // UYGULA — etkilenen her personnelId için helper (TEK KAYNAK). SİLME YOK.
  // İz OrgRevizyon'a yazılır; `yapan` düz metin olduğu için sistem çağrısı da iz bırakır
  // (aktör kullanıcı gerekmez — actorId geçilmez, yapanUserId null kalır).
  const etkilenen = Array.from(
    new Set([
      ...sarkanKoltuklar.map((k) => k.personnelId!),
      ...sarkanVekaletler.map((v) => v.vekilPersonnelId!),
    ])
  );
  console.log(`\nUYGULANIYOR — ${etkilenen.length} personel:`);
  for (const pid of etkilenen) {
    const sonuc = await personelPasiflestiginde(prisma, pid, { sebep: "SARKMA_TEMIZLIK" });
    console.log(`   ${pid}: ${sonuc.kapatilanKoltuklar.length} koltuk kapatıldı, ${sonuc.kaldirilanVekaletler.length} vekalet kaldırıldı`);
  }
  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ UYGULANDI.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
