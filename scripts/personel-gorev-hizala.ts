// Personnel.gorev alanını org şemasındaki POZİSYON ADIYLA hizalar.
//
// NEDEN: koltuk eşleştirmesi (src/lib/org/koltuk-eslesme.ts) gorev ↔ OrgUnit.name TAM
//   eşleşmesi arar. Personel kartlarındaki serbest metin ("MONTAJ OPERATÖRÜ") şemadaki
//   ada ("Mekanik Montaj Operatörü") uymadığı için kişiler koltuksuz kalıyor.
//   Eşanlamlı tablosu EKLENMEDİ (ayrı karar) — kaynak veri hizalanıyor.
//
// KAPSAM DAR ve AÇIK: yalnız aşağıdaki tabloda yazan (gorev) veya (bolum+bolumDetay)
//   kombinasyonları güncellenir. Başka hiçbir personelin görevine dokunulmaz.
//   Belirsiz olanlar (bolumDetay "DEPO OPERATÖRÜ" / "ŞOFÖR", KALİTE KONTROL, CNC-PRES)
//   BİLEREK dışarıda — tahmin yürütülmez, raporlanır, İK elle bağlar.
//
// ⚠️ ÖNKOŞUL: depo hedefleri scripts/org-depo-operator-pozisyon.ts ile açılmış olmalı.
//   Script hedef pozisyonun VARLIĞINI doğrular; yoksa o satırı uygulamaz (raporlar).
//
// VARSAYILAN DRY-RUN. --uygula olmadan yazmaz. Her kayıt tek tek listelenir.
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/personel-gorev-hizala.ts            # dry-run
//   npx tsx --env-file=.env scripts/personel-gorev-hizala.ts --uygula   # guncelle

import { prisma } from "@/lib/prisma";
import { normalizeAd } from "@/lib/org/koltuk-eslesme";

const UYGULA = process.argv.includes("--uygula");
const KOLTUKLULARI_DA = process.argv.includes("--koltuklulari-da-hizala");

// (1) Görev adı eşlemesi — BÖLÜM KISITLI.
//
// ⚠️ Bölüm kısıtı zorunlu: "MONTAJ OPERATÖRÜ" iki farklı bölümde geçiyor ve iki farklı
//    kutuya ait — MEKANİK MONTAJ → Mekanik Montaj Operatörü, ASANSÖR → Asansör Üretim
//    (bu 2 kişi zaten Asansör kutusunda oturuyor). Bölümsüz eşleme onların görevini
//    yanlış değiştirirdi.
//
// KAPSAM: yalnız KOLTUKSUZ personel. Aynı görev metnini taşıyıp ZATEN doğru kutuda
//    oturanlara dokunulmaz (ör. 4 "PRES OPERATÖRÜ" hâlihazırda Pres Operatörü
//    kutusunda). Onların görev metni de hizalanmak istenirse: --koltuklulari-da-hizala
//    (ayrı karar; koltuk yerleşimini DEĞİŞTİRMEZ, yalnız metni eşitler).
const GOREV_ESLEME: { eski: string; bolum: string; yeni: string; beklenen: number }[] = [
  { eski: "MONTAJ OPERATÖRÜ", bolum: "MEKANİK MONTAJ", yeni: "Mekanik Montaj Operatörü", beklenen: 2 },
  { eski: "KALIP OPERATÖRÜ", bolum: "KALIPHANE", yeni: "Kalıphane Operatörü", beklenen: 1 },
  // 09.09.2026 unvan esitleme turu: kutu "Preshane Operatörü" -> "Pres Operatörü"
  // olarak birlestirildi; eski hedef yazili kalsaydi bu betik birlestirmeyi geri alirdi.
  { eski: "PRES OPERATÖRÜ", bolum: "PRESHANE", yeni: "Pres Operatörü", beklenen: 1 },
  { eski: "CNC TORNA OPERATÖRÜ", bolum: "TALAŞLI İMALAT", yeni: "Talaşlı İmalat Operatörü", beklenen: 1 },
  { eski: "CNC OPERATÖRÜ", bolum: "TALAŞLI İMALAT", yeni: "Talaşlı İmalat Operatörü", beklenen: 1 },
  { eski: "İDARİ İŞLER PERSONELİ", bolum: "İDARİ İŞLER", yeni: "İdari İşler", beklenen: 1 },
];

// EKLENMEDİ — "YENİ İŞ GELİŞTİRME UZMAN" → "Yeni İş Geliştirme Uzmanı" (NEVZAT ONUR KIRAN,
// ILR-00253). Görev adını düzeltmek TEK BAŞINA yetmiyor: hedef ORG-ST-P06'nın üst zinciri
// "Satış & Pazarlama Müdürlüğü", personelin bölümü ise "SATIŞ VE PAZ.MÜDÜRLÜĞÜ" — ikisi
// birbirini kapsamadığı için eşleştirme bölüm doğrulamasında düşüyor (doğrudan test edildi).
// Satır eklenseydi görev metni değişir ama koltuk yine açılmazdı. Çözüm ayrı bir karar:
// (a) personelin bolum değerini şemadaki adla hizalamak, (b) bölüm karşılaştırmasını
// gevşetmek (ortak eşleştiriciyi etkiler), veya (c) İK'nın org şemasından elle bağlaması.

// (2) Depo: aynı görev metni ("DEPO OPERATÖRÜ") farklı depolara ait — ayrım bolumDetay'da.
const DEPO_ESLEME: { bolumDetay: string[]; yeni: string; beklenen: number }[] = [
  { bolumDetay: ["YARI MAMÜL", "YARI MAMUL"], yeni: "Yarı Mamul ve Hammadde Depo Operatörü", beklenen: 6 },
  { bolumDetay: ["TESELLÜM", "TESELLUM"], yeni: "Tesellüm Depo Operatörü", beklenen: 1 },
];
const DEPO_GOREV = "DEPO OPERATÖRÜ";

function dbAdi(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return decodeURIComponent(u.pathname.replace(/^\//, "")).split("?")[0];
  } catch {
    return "(bilinmiyor)";
  }
}

type Degisiklik = { id: string; sicilNo: string | null; adSoyad: string; eski: string; yeni: string };

async function main() {
  console.log(`🔌 Hedef DB: ${dbAdi()}`);
  console.log(`🧪 Mod: ${UYGULA ? "UYGULA (Personnel.gorev yazilir)" : "DRY-RUN (yalniz listeler)"}`);
  console.log("=".repeat(104));

  // Hedef pozisyon adları şemada VAR MI — yoksa o satır uygulanmaz (yanlis ad yazmayalim).
  const pozisyonlar = await prisma.orgUnit.findMany({
    where: { unitType: "POSITION", isActive: true },
    select: { name: true, code: true },
  });
  const pozisyonAdlari = new Set(pozisyonlar.map((p) => normalizeAd(p.name)));
  const hedefVarMi = (ad: string) => pozisyonAdlari.has(normalizeAd(ad));

  const tumAktifler = await prisma.personnel.findMany({
    where: { aktif: true },
    select: { id: true, sicilNo: true, adSoyad: true, bolum: true, bolumDetay: true, gorev: true },
    orderBy: [{ bolum: "asc" }, { adSoyad: "asc" }],
  });
  // Koltuklu olanlar varsayilan kapsamin DISINDA (zaten dogru kutuda oturuyorlar).
  const koltuklu = new Set(
    (
      await prisma.orgEmployee.findMany({
        where: { isActive: true, personnelId: { not: null } },
        select: { personnelId: true },
      })
    ).map((k) => k.personnelId!),
  );
  const aktifler = KOLTUKLULARI_DA ? tumAktifler : tumAktifler.filter((p) => !koltuklu.has(p.id));
  const kapsamDisi = KOLTUKLULARI_DA ? [] : tumAktifler.filter((p) => koltuklu.has(p.id));

  const degisiklikler: Degisiklik[] = [];
  const hedefiYok: { ad: string; kisi: number }[] = [];
  const sayimUyari: string[] = [];

  // (1) görev adı eşlemesi
  for (const e of GOREV_ESLEME) {
    const eslesen = aktifler.filter(
      (p) => normalizeAd(p.gorev) === normalizeAd(e.eski) && normalizeAd(p.bolum) === normalizeAd(e.bolum),
    );
    if (!hedefVarMi(e.yeni)) {
      hedefiYok.push({ ad: e.yeni, kisi: eslesen.length });
      continue;
    }
    if (eslesen.length !== e.beklenen) {
      sayimUyari.push(`"${e.eski}" (${e.bolum}) → beklenen ${e.beklenen}, bulunan ${eslesen.length}`);
    }
    for (const p of eslesen) {
      degisiklikler.push({ id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad, eski: p.gorev, yeni: e.yeni });
    }
  }

  // (2) depo eşlemesi — bolumDetay'a göre
  const depocular = aktifler.filter(
    (p) => p.bolum === "DEPO" && normalizeAd(p.gorev) === normalizeAd(DEPO_GOREV),
  );
  const depoDokunulmayan: typeof depocular = [];
  for (const p of depocular) {
    const kural = DEPO_ESLEME.find((d) =>
      d.bolumDetay.some((x) => normalizeAd(x) === normalizeAd(p.bolumDetay ?? "")),
    );
    if (!kural) {
      depoDokunulmayan.push(p);
      continue;
    }
    if (!hedefVarMi(kural.yeni)) {
      const v = hedefiYok.find((h) => h.ad === kural.yeni);
      if (v) v.kisi += 1;
      else hedefiYok.push({ ad: kural.yeni, kisi: 1 });
      continue;
    }
    degisiklikler.push({ id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad, eski: p.gorev, yeni: kural.yeni });
  }
  for (const d of DEPO_ESLEME) {
    const n = degisiklikler.filter((x) => x.yeni === d.yeni).length;
    if (hedefVarMi(d.yeni) && n !== d.beklenen) {
      sayimUyari.push(`depo "${d.yeni}" → beklenen ${d.beklenen}, bulunan ${n}`);
    }
  }

  console.log(`\n✅ GUNCELLENECEK: ${degisiklikler.length} kayit`);
  if (degisiklikler.length > 0) {
    console.log(`   ${"SİCİL".padEnd(11)} ${"AD SOYAD".padEnd(26)} ${"ESKİ GÖREV".padEnd(24)} → YENİ GÖREV`);
    for (const d of degisiklikler) {
      console.log(
        `   ${(d.sicilNo ?? "-").padEnd(11)} ${d.adSoyad.slice(0, 26).padEnd(26)} ` +
          `${d.eski.slice(0, 24).padEnd(24)} → ${d.yeni}`,
      );
    }
  }

  if (depoDokunulmayan.length > 0) {
    console.log(`\n⏭️  DEPO — DOKUNULMADI (belirsiz bolumDetay): ${depoDokunulmayan.length}`);
    for (const p of depoDokunulmayan) {
      console.log(
        `   ${(p.sicilNo ?? "-").padEnd(11)} ${p.adSoyad.slice(0, 26).padEnd(26)} ` +
          `bolumDetay: "${p.bolumDetay ?? "-"}"  → elle baglanacak`,
      );
    }
  }

  if (kapsamDisi.length > 0) {
    const eskiAdliKoltuklu = kapsamDisi.filter((p) =>
      GOREV_ESLEME.some(
        (e) => normalizeAd(p.gorev) === normalizeAd(e.eski) && normalizeAd(p.bolum) === normalizeAd(e.bolum),
      ),
    );
    if (eskiAdliKoltuklu.length > 0) {
      console.log(
        `\nℹ️  KOLTUKLU ama eski gorev metnini tasiyanlar: ${eskiAdliKoltuklu.length} (DOKUNULMADI)`,
      );
      for (const p of eskiAdliKoltuklu) {
        console.log(
          `   ${(p.sicilNo ?? "-").padEnd(11)} ${p.adSoyad.slice(0, 26).padEnd(26)} ${p.gorev}`,
        );
      }
      console.log(`   → Metinleri de hizalamak icin: --koltuklulari-da-hizala (koltuk YERI degismez)`);
    }
  }

  if (hedefiYok.length > 0) {
    console.log(`\n⚠️  HEDEF POZISYON SEMADA YOK — bu satirlar UYGULANMADI:`);
    for (const h of hedefiYok) console.log(`   · "${h.ad}" (${h.kisi} kisi)`);
    console.log(`   → Once: npx tsx --env-file=.env scripts/org-depo-operator-pozisyon.ts --uygula`);
  }

  if (sayimUyari.length > 0) {
    console.log(`\n🚨 SAYIM UYUSMAZLIGI — beklenenden farkli:`);
    for (const u of sayimUyari) console.log(`   · ${u}`);
  }

  console.log(`\n${"=".repeat(104)}`);
  console.log(
    `ÖZET  guncellenecek:${degisiklikler.length}  depo-dokunulmayan:${depoDokunulmayan.length}  ` +
      `hedefi-yok:${hedefiYok.length}  sayim-uyarisi:${sayimUyari.length}`,
  );

  if (!UYGULA) {
    console.log("💡 DRY-RUN — degisiklik yapilmadi. Guncellemek icin: --uygula");
    console.log("   Sonrasi: npx tsx --env-file=.env scripts/org-koltuk-olustur.ts");
    return;
  }
  if (sayimUyari.length > 0) {
    console.log("\n❌ Sayim uyusmazligi var — UYGULANMADI. Once farki incele.");
    process.exitCode = 1;
    return;
  }
  if (degisiklikler.length === 0) {
    console.log("Guncellenecek kayit yok.");
    return;
  }

  console.log(`\nUYGULANIYOR — ${degisiklikler.length} kayit...`);
  for (const d of degisiklikler) {
    await prisma.personnel.update({ where: { id: d.id }, data: { gorev: d.yeni } });
  }
  console.log(`✅ ${degisiklikler.length} kayit guncellendi.`);
  console.log("   Siradaki: npx tsx --env-file=.env scripts/org-koltuk-olustur.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
