// İş Analizi ÖN-KOŞUL TEŞHİSİ — salt okuma, DB'ye YAZMAZ.
// Amaç: IA akışının canlıya hazır olup olmadığını ölçmek (koltuk/amir/yetkinlik boşlukları).
// Prod-guard: DATABASE_URL db adı 'ilerihub' (prod) ise ÇIKAR. Yalnız staging/dev/test.
//
// Çalıştırma:
//   DATABASE_URL="<staging_url>" npx tsx --env-file=.env scripts/ia-onkosul-kontrol.ts
//   (veya .env'de staging DATABASE_URL varsa doğrudan)

import { prisma } from "@/lib/prisma";
import { amirCozumle } from "@/lib/is-analizi/amir-cozumle";

function dbAdi(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return decodeURIComponent(u.pathname.replace(/^\//, "")).split("?")[0];
  } catch {
    return "";
  }
}

async function main() {
  const db = dbAdi();
  console.log(`🔌 Hedef DB: ${db || "(bilinmiyor)"}`);
  if (db === "ilerihub") {
    console.error("❌ PROD-GUARD: 'ilerihub' (prod) — bu teşhis yalnız staging/dev'de çalışır. Çıkılıyor.");
    process.exit(1);
  }
  console.log("=".repeat(56));

  // 1) OrgEmployee.personnelId boş koltuklar
  const bosKoltukSayisi = await prisma.orgEmployee.count({ where: { personnelId: null } });
  const bosKoltuklar = await prisma.orgEmployee.findMany({
    where: { personnelId: null },
    take: 20,
    select: { displayName: true, orgUnit: { select: { name: true } } },
  });
  console.log(`\n1) OrgEmployee.personnelId BOŞ koltuk sayısı: ${bosKoltukSayisi}`);
  console.log("   İlk 20 (birim — koltuk):");
  bosKoltuklar.forEach((k) => console.log(`   · ${k.orgUnit?.name ?? "?"} — ${k.displayName}`));

  // 2) User.personnelId boş aktif kullanıcı
  const bosUser = await prisma.user.count({ where: { isActive: true, personnelId: null } });
  const aktifUser = await prisma.user.count({ where: { isActive: true } });
  console.log(`\n2) Aktif User: ${aktifUser} · personnelId BOŞ olan: ${bosUser}`);

  // 3) amirCozumle dağılımı (aktif personel)
  const personeller = await prisma.personnel.findMany({ where: { aktif: true }, select: { id: true } });
  let org = 0, isimGuvenilir = 0, isimGuvensiz = 0, yok = 0;
  for (const p of personeller) {
    const a = await amirCozumle(p.id);
    if (a.kaynak === "ORG") org++;
    else if (a.kaynak === "ISIM") a.guvenilir ? isimGuvenilir++ : isimGuvensiz++;
    else yok++;
  }
  console.log(`\n3) amirCozumle dağılımı (aktif personel: ${personeller.length}):`);
  console.log(`   ORG (ağaçtan, güvenilir):   ${org}`);
  console.log(`   ISIM (tek eşleşme):         ${isimGuvenilir}`);
  console.log(`   ISIM (eşleşmedi / çoklu):   ${isimGuvensiz}`);
  console.log(`   amir YOK:                   ${yok}`);

  // 4) Yetkinlik verisi (tablo yoksa migration uygulanmamış → 'tablo yok')
  let iaPoz = "—", iaYet = "—";
  try { iaPoz = String(await prisma.iaPozisyon.count()); } catch { iaPoz = "tablo yok (migration uygulanmamış)"; }
  try { iaYet = String(await prisma.iaYetkinlik.count()); } catch { iaYet = "tablo yok (migration uygulanmamış)"; }
  console.log(`\n4) IaPozisyon kayıt: ${iaPoz} · IaYetkinlik kayıt: ${iaYet}`);
  console.log(`   (yetkinlik adımı boş geçecek mi → IaPozisyon/IaYetkinlik dolu değilse EVET)`);

  console.log("\n" + "=".repeat(56));
  console.log("✅ Teşhis tamam — DB'ye hiçbir şey yazılmadı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
