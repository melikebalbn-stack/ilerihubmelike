// Org şeması — BAĞSIZ KOLTUK onarımı: OrgEmployee.personnelId = NULL olan aktif
// koltukları displayName üzerinden Personnel'e bağlar.
//
// NEDEN: senkron (personel-koltuk-senkron), org-chart G1 filtresi ve sarkma kontrolü
//   üçü de personnelId üzerinden çalışır. Bağ yoksa çıkmış personel şemada dolu
//   koltuk olarak durur ve hiçbir kontrole yakalanmaz.
//
// KÖKEN: bu koltuklar prisma/seed-org-*.ts akışından geliyor. Seed isim eşleştirmesini
//   YALNIZ aktif personel üzerinde yapıyor (`where: { aktif: true }`); seed anında zaten
//   pasif olan kişi eşleşemiyor ve koltuk personnelId=null doğuyor.
//   Bu script AYNI normalize() semantiğini kullanır ama TÜM personeli (pasif dahil) tarar.
//
// GÜVENLİK KURALLARI
//   - VARSAYILAN DRY-RUN. --uygula olmadan tek satır yazmaz.
//   - Yalnız TEK TAM eşleşme bağlanır. 0 / >1 eşleşme → BAĞLANMAZ, raporlanır.
//   - Tam eşleşme tek olsa bile, aynı ismin AKTİF bir "uzun sürümü" varsa
//     (token üstkümesi: "KORAY ILERI" ⊂ "KORAY MERT ILERI") belirsiz sayılır ve
//     BAĞLANMAZ — mükerrer/ikinci ad kayıtlarına yanlış bağ kurmamak için.
//   - SİLME YOK, koltuk kapatma YOK. Kapatma ayrı adım:
//     scripts/org-pasif-sarkma-kontrol.ts --uygula
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/org-koltuk-personel-baglama.ts            # dry-run
//   npx tsx --env-file=.env scripts/org-koltuk-personel-baglama.ts --uygula   # bağla

import { prisma } from "@/lib/prisma";

const UYGULA = process.argv.includes("--uygula");

// prisma/seed-org-*.ts ile AYNI normalize — koltuk hangi kurala göre doğduysa
// onarım da aynı kurala göre yapılsın diye birebir kopyalandı.
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

function tokenlar(norm: string): string[] {
  return norm.split(" ").filter(Boolean);
}

// b, a'nın TÜM token'larını içeriyor ve en az bir fazlası var mı?
// "KORAY ILERI" ⊂ "KORAY MERT ILERI" → true (ikinci ad / mükerrer şüphesi)
function strictUstKume(a: string[], b: string[]): boolean {
  if (b.length <= a.length) return false;
  const havuz = [...b];
  for (const t of a) {
    const i = havuz.indexOf(t);
    if (i === -1) return false;
    havuz.splice(i, 1);
  }
  return true;
}

function dbAdi(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return decodeURIComponent(u.pathname.replace(/^\//, "")).split("?")[0];
  } catch {
    return "(bilinmiyor)";
  }
}

type PersonelKaydi = { id: string; adSoyad: string; sicilNo: string | null; aktif: boolean };

type Karar =
  | { tip: "BAGLA"; personel: PersonelKaydi }
  | { tip: "ATLA"; sebep: string; adaylar: PersonelKaydi[] };

async function main() {
  console.log(`🔌 Hedef DB: ${dbAdi()}`);
  console.log(`🧪 Mod: ${UYGULA ? "UYGULA (personnelId yazılacak)" : "DRY-RUN (yalnız listeler)"}`);
  console.log("=".repeat(78));

  // TÜM personel — pasif DAHİL. Seed'in aksine burada pasifleri de arıyoruz;
  // asıl aradığımız zaten "çıkmış ama koltukta duran" kişiler.
  const tumPersonel = await prisma.personnel.findMany({
    select: { id: true, adSoyad: true, sicilNo: true, aktif: true },
  });

  const tamEslesme = new Map<string, PersonelKaydi[]>();
  for (const p of tumPersonel) {
    const key = normalize(p.adSoyad);
    if (!key) continue;
    const arr = tamEslesme.get(key) ?? [];
    arr.push(p);
    tamEslesme.set(key, arr);
  }
  const normluPersonel = tumPersonel.map((p) => ({ p, tok: tokenlar(normalize(p.adSoyad)) }));

  const bagsizKoltuklar = await prisma.orgEmployee.findMany({
    where: { personnelId: null, isActive: true },
    select: {
      id: true,
      displayName: true,
      orgUnit: { select: { code: true, name: true } },
    },
    orderBy: { displayName: "asc" },
  });

  console.log(`\nBağsız aktif koltuk: ${bagsizKoltuklar.length}\n`);

  const baglanacak: { koltukId: string; kod: string; pozisyon: string; isim: string; personel: PersonelKaydi }[] = [];
  const atlanacak: { kod: string; pozisyon: string; isim: string; sebep: string; adaylar: PersonelKaydi[] }[] = [];

  for (const k of bagsizKoltuklar) {
    const norm = normalize(k.displayName);
    const tok = tokenlar(norm);
    const tam = tamEslesme.get(norm) ?? [];
    // Aynı ismin AKTİF uzun sürümü (ikinci ad) — mükerrer kayıt şüphesi
    const aktifUstKume = normluPersonel
      .filter(({ p, tok: pt }) => p.aktif && strictUstKume(tok, pt))
      .map(({ p }) => p);

    let karar: Karar;
    if (tam.length === 1 && aktifUstKume.length === 0) {
      karar = { tip: "BAGLA", personel: tam[0] };
    } else if (tam.length === 1 && aktifUstKume.length > 0) {
      karar = {
        tip: "ATLA",
        sebep: `belirsiz — aktif uzun sürüm var (${aktifUstKume.map((a) => a.adSoyad).join(", ")})`,
        adaylar: [...tam, ...aktifUstKume],
      };
    } else if (tam.length === 0) {
      karar = {
        tip: "ATLA",
        sebep: aktifUstKume.length > 0 ? `eşleşme yok — yakın aday var` : "eşleşme yok",
        adaylar: aktifUstKume,
      };
    } else {
      karar = { tip: "ATLA", sebep: `belirsiz — ${tam.length} tam eşleşme`, adaylar: tam };
    }

    const kod = k.orgUnit?.code ?? "?";
    const pozisyon = k.orgUnit?.name ?? "?";
    if (karar.tip === "BAGLA") {
      baglanacak.push({ koltukId: k.id, kod, pozisyon, isim: k.displayName, personel: karar.personel });
    } else {
      atlanacak.push({ kod, pozisyon, isim: k.displayName, sebep: karar.sebep, adaylar: karar.adaylar });
    }
  }

  // ── BAĞLANACAK ──
  console.log(`✅ BAĞLANACAK: ${baglanacak.length}`);
  if (baglanacak.length > 0) {
    console.log(
      `   ${"KOD".padEnd(20)} ${"POZİSYON".padEnd(34)} ${"KOLTUKTAKİ".padEnd(20)} ${"SİCİL".padEnd(11)} DURUM`
    );
    for (const b of baglanacak) {
      console.log(
        `   ${b.kod.padEnd(20)} ${b.pozisyon.slice(0, 34).padEnd(34)} ${b.isim.slice(0, 20).padEnd(20)} ` +
          `${(b.personel.sicilNo ?? "—").padEnd(11)} ${b.personel.aktif ? "aktif" : "PASİF ← sarkma"}`
      );
    }
    const pasifSayisi = baglanacak.filter((b) => !b.personel.aktif).length;
    console.log(
      `\n   → ${pasifSayisi} tanesi PASİF personel. Bağ kurulunca sarkma kontrolüne görünür olacaklar.`
    );
  }

  // ── ATLANACAK ──
  console.log(`\n⏭️  ATLANACAK: ${atlanacak.length}`);
  const sebepGrup = new Map<string, number>();
  for (const a of atlanacak) {
    const anahtar = a.sebep.split(" — ")[0] + (a.sebep.includes("uzun sürüm") ? " (mükerrer şüphesi)" : "");
    sebepGrup.set(anahtar, (sebepGrup.get(anahtar) ?? 0) + 1);
  }
  for (const [s, n] of [...sebepGrup].sort((x, y) => y[1] - x[1])) {
    console.log(`   · ${s}: ${n}`);
  }

  const belirsizler = atlanacak.filter((a) => a.sebep.startsWith("belirsiz"));
  if (belirsizler.length > 0) {
    console.log(`\n   ⚠️  ELLE KARAR GEREKENLER (${belirsizler.length}) — bağ KURULMADI:`);
    for (const a of belirsizler) {
      console.log(`      ${a.kod} · ${a.pozisyon} · "${a.isim}"`);
      console.log(`         sebep: ${a.sebep}`);
      for (const c of a.adaylar) {
        console.log(`         aday: ${c.adSoyad} [${c.sicilNo ?? "sicilsiz"}] ${c.aktif ? "aktif" : "pasif"}`);
      }
    }
  }

  const eslesmeyen = atlanacak.filter((a) => a.sebep.startsWith("eşleşme yok"));
  if (eslesmeyen.length > 0) {
    console.log(
      `\n   ℹ️  Personel kaydı bulunamayanlar (${eslesmeyen.length}) — dış danışman / ünvan / placeholder olabilir:`
    );
    for (const a of eslesmeyen) {
      console.log(`      ${a.kod.padEnd(20)} ${a.pozisyon.slice(0, 34).padEnd(34)} "${a.isim}"`);
    }
  }

  if (!UYGULA) {
    console.log(`\n${"=".repeat(78)}`);
    console.log("💡 DRY-RUN — hiçbir şey yazılmadı. Bağlamak için: --uygula");
    console.log("   Bağladıktan SONRA sarkma temizliği:");
    console.log("   npx tsx --env-file=.env scripts/org-pasif-sarkma-kontrol.ts        # önce dry-run");
    return;
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log(`UYGULANIYOR — ${baglanacak.length} koltuk bağlanıyor (SİLME/KAPATMA YOK)...`);
  let n = 0;
  for (const b of baglanacak) {
    await prisma.orgEmployee.update({
      where: { id: b.koltukId },
      data: { personnelId: b.personel.id },
    });
    n++;
  }
  console.log(`✅ ${n} koltuk bağlandı.`);
  console.log("   Koltuklar KAPATILMADI. Pasif olanları kapatmak için:");
  console.log("   npx tsx --env-file=.env scripts/org-pasif-sarkma-kontrol.ts --uygula");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
