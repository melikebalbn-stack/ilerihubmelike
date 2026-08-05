// Envanter Faz 2 — ÖN-KOŞUL / UYUMLULUK KONTROLÜ. SALT OKUMA (DB'ye YAZMAZ).
// DB'nin GERÇEK durumunu information_schema / pg_constraint üzerinden okur (migration
// öncesi yeni kolonlar Prisma client'ta görünse de DB'de olmayabilir → ham sorgu).
//
// Kontroller:
//   1) 8 yeni Faz2 kolonu hedef tablolarda VAR MI (migration uygulandı mı)
//   2) envanter_bakim_yonlendirme tablosu VAR MI
//   3) envanter operasyonel tablolarındaki satır sayıları (göç hacmi)
//   4) EnvanterZimmet.personnelId FK onDelete davranışı Restrict mi (drift kontrolü)
//
// Çalıştırma:
//   npx tsx --env-file=.env scripts/envanter-faz2-onkosul.ts

import { prisma } from "@/lib/prisma";

function dbAdi(): string {
  try {
    return decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "")).split("?")[0];
  } catch {
    return "(bilinmiyor)";
  }
}

// Faz2 yeni kolonlar: [tablo, kolon]
const YENI_KOLONLAR: Array<[string, string]> = [
  ["envanter_zimmet", "kkdUstGrubu"],
  ["envanter_zimmet", "kkdAltGrubu"],
  ["envanter_zimmet", "verilmeTarihi"],
  ["envanter_stok_hareket", "alanPersonelAd"],
  ["envanter_stok_hareket", "alanPersonelId"],
  ["envanter_stok_hareket", "bolum"],
  ["envanter_stok_hareket", "geriAlindi"],
  ["envanter_stok", "birimMaliyet"],
  ["envanter_stok", "paraBirimi"],
];

const OPERASYONEL_TABLOLAR = [
  "envanter_urun",
  "envanter_urun_varyant",
  "envanter_stok",
  "envanter_stok_hareket",
  "envanter_zimmet",
  "envanter_kategori",
  "envanter_bakim_yonlendirme",
];

async function kolonVarMi(tablo: string, kolon: string): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tablo} AND column_name = ${kolon}`;
  return Number(r[0]?.n ?? 0) > 0;
}

async function tabloVarMi(tablo: string): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tablo}`;
  return Number(r[0]?.n ?? 0) > 0;
}

async function satirSayisi(tablo: string): Promise<number | null> {
  try {
    const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*)::bigint AS n FROM "${tablo}"`);
    return Number(r[0]?.n ?? 0);
  } catch {
    return null; // tablo yok
  }
}

// EnvanterZimmet.personnelId FK'sının onDelete davranışı (r=RESTRICT, c=CASCADE, a=NO ACTION, n=SET NULL)
async function zimmetPersonelOnDelete(): Promise<string> {
  const r = await prisma.$queryRaw<Array<{ confdeltype: string }>>`
    SELECT c.confdeltype
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'envanter_zimmet' AND c.contype = 'f' AND a.attname = 'personnelId'`;
  const map: Record<string, string> = { r: "RESTRICT", c: "CASCADE", a: "NO ACTION", n: "SET NULL", d: "SET DEFAULT" };
  return r[0] ? (map[r[0].confdeltype] ?? r[0].confdeltype) : "(FK bulunamadı)";
}

async function main() {
  console.log(`🔌 Hedef DB: ${dbAdi()}  (SALT OKUMA)`);
  console.log("=".repeat(60));

  console.log("\n1) Faz2 yeni kolonlar hedef tablolarda VAR mı (migration uygulandı mı):");
  let varSay = 0;
  for (const [t, k] of YENI_KOLONLAR) {
    const v = await kolonVarMi(t, k);
    if (v) varSay++;
    console.log(`   [${v ? "VAR" : "YOK"}] ${t}.${k}`);
  }
  console.log(`   → ${varSay}/${YENI_KOLONLAR.length} kolon mevcut ${varSay === 0 ? "(migration UYGULANMAMIŞ)" : varSay === YENI_KOLONLAR.length ? "(migration UYGULANMIŞ)" : "(KISMİ — dikkat)"}`);

  console.log("\n2) envanter_bakim_yonlendirme tablosu:");
  console.log(`   [${(await tabloVarMi("envanter_bakim_yonlendirme")) ? "VAR" : "YOK"}]`);

  console.log("\n3) Envanter operasyonel tablo satır sayıları (göç hacmi):");
  for (const t of OPERASYONEL_TABLOLAR) {
    const n = await satirSayisi(t);
    console.log(`   ${t}: ${n === null ? "(tablo yok)" : n}`);
  }

  console.log("\n4) EnvanterZimmet.personnelId FK onDelete davranışı:");
  const od = await zimmetPersonelOnDelete();
  console.log(`   ${od}  ${od === "RESTRICT" ? "✓ (beklenen — personel silinince zimmet düşmez)" : "⚠️ RESTRICT değil!"}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Kontrol tamam — DB'ye hiçbir şey yazılmadı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
