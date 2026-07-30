// Org şeması — PASİF personel SARKMA tespiti/temizliği.
// Sarkma = Personnel.aktif=false AMA OrgEmployee.isActive=true (koltuk hâlâ dolu görünüyor),
//   veya pasif kişi bir OrgUnit'te hâlâ VEKİL (vekilPersonnelId).
//
// VARSAYILAN DRY-RUN: yalnız listeler. --uygula ile koltukları kapatır + vekaleti kaldırır
//   (personel-koltuk-senkron helper'ı üzerinden — SİLME YOK, kayıt korunur).
// Prod-guard DEĞİL (bilinçli çalıştırılır) ama hangi DB'ye bağlandığını yazar.
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/org-pasif-sarkma-kontrol.ts            # dry-run
//   npx tsx --env-file=.env scripts/org-pasif-sarkma-kontrol.ts --uygula   # temizle

import { prisma } from "@/lib/prisma";
import { personelPasiflestiginde } from "@/lib/org/personel-koltuk-senkron";

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

  console.log(`\n1) Sarkan KOLTUK (pasif personel + aktif koltuk): ${sarkanKoltuklar.length}`);
  sarkanKoltuklar.forEach((k) =>
    console.log(`   · ${k.displayName} — ${k.orgUnit?.name ?? "?"} (${k.orgUnit?.code ?? "?"}) [personnelId=${k.personnelId}]`)
  );
  console.log(`\n2) Sarkan VEKALET (pasif kişi hâlâ vekil): ${sarkanVekaletler.length}`);
  sarkanVekaletler.forEach((v) =>
    console.log(`   · ${v.vekilAdi ?? "?"} → ${v.name} (${v.code}) [vekilPersonnelId=${v.vekilPersonnelId}]`)
  );

  if (!UYGULA) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("💡 DRY-RUN — değişiklik yapılmadı. Kapatmak için: --uygula");
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
