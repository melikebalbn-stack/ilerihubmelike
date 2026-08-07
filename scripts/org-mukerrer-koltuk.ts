// Org şeması — MÜKERRER koltuk tespiti/temizliği.
//
// MÜKERRER TANIMI (dar, kasıtlı): aynı personelin AYNI OrgUnit'te birden fazla AÇIK koltuğu.
//   Farklı OrgUnit'lerdeki çoklu koltuk MEŞRUDUR (kurul üyelikleri: BGYS/KVKK/Etik/
//   Disiplin/MMOG + kişinin kendi departmanı) — bunlara DOKUNULMAZ.
//
// AYRICA RAPORLANIR (kapatılmaz): aynı kişi + AYNI UNVAN, FARKLI OrgUnit.
//   Prod'da bu 4 vaka var ve hepsi departman ağacı (ORG-XX-P01) + yönetim ağacı
//   (ORG-YN-Pnn) ikilisi. ORG-YN ayrı ve meşru bir hiyerarşi (Genel Müdür → GMY →
//   müdürler); ORG-KR kurul koltuklarıyla aynı kategoride "bir kişi, birden çok birim".
//   Bu yüzden VARSAYILAN OLARAK KAPATILMAZ — yalnız rapor edilir.
//   Yine de kapatılması istenirse: --unvan-cakismasini-da-kapat
//
// VARSAYILAN DRY-RUN. --uygula olmadan tek satır yazmaz. SİLME YOK (isActive=false).
// İz: OrgRevizyon (yapan: "Sistem — MUKERRER_TEMIZLIK").
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/org-mukerrer-koltuk.ts            # dry-run
//   npx tsx --env-file=.env scripts/org-mukerrer-koltuk.ts --uygula   # kapat

import { prisma } from "@/lib/prisma";
import { koltukKapat } from "@/lib/org/personel-koltuk-senkron";
import { normalizeAd } from "@/lib/org/koltuk-eslesme";

const UYGULA = process.argv.includes("--uygula");
const UNVAN_DA = process.argv.includes("--unvan-cakismasini-da-kapat");

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
  console.log(`🧪 Mod: ${UYGULA ? "UYGULA (eski koltuk kapatilir)" : "DRY-RUN (yalniz listeler)"}`);
  if (UNVAN_DA) console.log(`⚠️  --unvan-cakismasini-da-kapat AÇIK — unvan çakışmaları da kapatılacak`);
  console.log("=".repeat(78));

  const koltuklar = await prisma.orgEmployee.findMany({
    where: { isActive: true, personnelId: { not: null } },
    select: {
      id: true,
      personnelId: true,
      orgUnitId: true,
      displayName: true,
      createdAt: true,
      orgUnit: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const pids = [...new Set(koltuklar.map((k) => k.personnelId!).filter(Boolean))];
  const personeller = await prisma.personnel.findMany({
    where: { id: { in: pids } },
    select: { id: true, sicilNo: true, adSoyad: true },
  });
  const pById = new Map(personeller.map((p) => [p.id, p]));

  // (A) GERÇEK MÜKERRER — aynı personel + aynı OrgUnit
  const ayniBirim = new Map<string, typeof koltuklar>();
  for (const k of koltuklar) {
    const key = `${k.personnelId}::${k.orgUnitId}`;
    const arr = ayniBirim.get(key) ?? [];
    arr.push(k);
    ayniBirim.set(key, arr);
  }
  const gercekMukerrer = [...ayniBirim.values()].filter((g) => g.length > 1);

  console.log(`\n── A) GERÇEK MÜKERRER (ayni personel + AYNI OrgUnit) ──`);
  console.log(`Bulunan: ${gercekMukerrer.length} vaka`);
  const kapatilacak: { id: string; personnelId: string; etiket: string }[] = [];
  for (const grup of gercekMukerrer) {
    const p = pById.get(grup[0].personnelId!);
    console.log(`\n   ${p?.adSoyad ?? "?"} [${p?.sicilNo ?? "-"}] — ${grup[0].orgUnit?.name} (${grup[0].orgUnit?.code})`);
    grup.forEach((k, i) => {
      const rol = i === grup.length - 1 ? "KALIR (en yeni)" : "KAPATILACAK (eski)";
      console.log(`      · ${k.createdAt.toISOString().slice(0, 16).replace("T", " ")}  ${rol}`);
      if (i < grup.length - 1) {
        kapatilacak.push({
          id: k.id,
          personnelId: k.personnelId!,
          etiket: `${k.orgUnit?.name ?? "?"} (${k.orgUnit?.code ?? "?"})`,
        });
      }
    });
  }
  if (gercekMukerrer.length === 0) {
    console.log(`   ✅ Yok — aynı birimde çift koltuk bulunmadı.`);
  }

  // (B) UNVAN ÇAKIŞMASI — aynı personel + aynı unvan, FARKLI OrgUnit (rapor)
  const ayniUnvan = new Map<string, typeof koltuklar>();
  for (const k of koltuklar) {
    const key = `${k.personnelId}::${normalizeAd(k.orgUnit?.name ?? "")}`;
    const arr = ayniUnvan.get(key) ?? [];
    arr.push(k);
    ayniUnvan.set(key, arr);
  }
  const unvanCakisma = [...ayniUnvan.values()].filter(
    (g) => g.length > 1 && new Set(g.map((x) => x.orgUnitId)).size > 1,
  );

  console.log(`\n── B) UNVAN ÇAKIŞMASI (ayni unvan, FARKLI birim) — ${UNVAN_DA ? "KAPATILACAK" : "RAPOR"} ──`);
  console.log(`Bulunan: ${unvanCakisma.length} vaka`);
  for (const grup of unvanCakisma) {
    const p = pById.get(grup[0].personnelId!);
    console.log(`\n   ${p?.adSoyad ?? "?"} [${p?.sicilNo ?? "-"}] — "${grup[0].orgUnit?.name}"`);
    grup.forEach((k, i) => {
      const rol = UNVAN_DA ? (i === grup.length - 1 ? "KALIR" : "KAPATILACAK") : "korunuyor";
      console.log(`      · ${(k.orgUnit?.code ?? "?").padEnd(16)} ${k.createdAt.toISOString().slice(0, 16).replace("T", " ")}  ${rol}`);
      if (UNVAN_DA && i < grup.length - 1) {
        kapatilacak.push({
          id: k.id,
          personnelId: k.personnelId!,
          etiket: `${k.orgUnit?.name ?? "?"} (${k.orgUnit?.code ?? "?"})`,
        });
      }
    });
  }
  if (unvanCakisma.length > 0 && !UNVAN_DA) {
    console.log(`\n   ℹ️  Bunlar departman ağacı + yönetim ağacı (ORG-YN) ikilisidir.`);
    console.log(`      ORG-YN ayrı ve meşru bir hiyerarşidir; kurul koltuklarıyla aynı kategoride.`);
    console.log(`      Kapatmak için: --unvan-cakismasini-da-kapat (önce dry-run ile gör).`);
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log(`ÖZET  gercek-mukerrer:${gercekMukerrer.length}  unvan-cakismasi:${unvanCakisma.length}  kapatilacak-koltuk:${kapatilacak.length}`);

  if (!UYGULA) {
    console.log("💡 DRY-RUN — degisiklik yapilmadi. Kapatmak icin: --uygula");
    return;
  }
  if (kapatilacak.length === 0) {
    console.log("Kapatilacak koltuk yok.");
    return;
  }

  console.log(`\nUYGULANIYOR — ${kapatilacak.length} koltuk kapatiliyor (SILME YOK)...`);
  for (const k of kapatilacak) {
    await koltukKapat(prisma, k.id, {
      sebep: "MUKERRER_TEMIZLIK",
      aciklama: `Mükerrer koltuk kapatıldı: ${k.etiket}`,
    });
    console.log(`   · kapatildi: ${k.etiket}`);
  }
  console.log("✅ UYGULANDI.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
