/**
 * Org şeması ad normalizasyonu — TEK KAYNAK (saf, bağımlılıksız).
 *
 * NEDEN AYRI DOSYA: kural koltuk-eslesme.ts'te tanımlıydı ama o dosya
 * `@/lib/prisma` import ettiği için SUNUCU-ONLY. GorevSecici bir client
 * component olduğundan onu import edemiyordu ve kuralın birebir kopyasını
 * kendi içinde taşıyordu (GorevSecici.tsx:29-38). İki kopya zamanla ayrışırsa
 * listeden seçilen görev sunucuda eşleşmez ve koltuk açılmaz.
 *
 * Bu dosyanın hiçbir import'u yok — hem sunucudan hem istemciden güvenle
 * çağrılır. koltuk-eslesme.ts ve pozisyon-secenekleri.ts buradan alır;
 * GorevSecici ve BolumSecici de.
 *
 * Davranış koltuk-eslesme.ts'teki eski tanımla BİREBİR aynı:
 * Türkçe büyük harf → aksan sadeleştirme → alfanümerik dışı tek boşluk → trim.
 */

/** Türkçe büyük harf — düz toUpperCase() i/ı'yı bozar. */
export function buyukTR(s: string): string {
  return (s ?? "").toLocaleUpperCase("tr-TR")
}

const DIACRITIC_MAP: Record<string, string> = {
  Ç: "C",
  Ğ: "G",
  Ş: "S",
  Ö: "O",
  Ü: "U",
  İ: "I",
}

export function normalizeAd(input: string): string {
  if (!input) return ""
  let s = buyukTR(input)
  s = s.replace(/[ÇĞŞÖÜİ]/g, (ch) => DIACRITIC_MAP[ch] ?? ch)
  s = s.replace(/[^A-Z0-9]+/g, " ")
  return s.trim().replace(/\s+/g, " ")
}

/**
 * Onay zinciri ad eşleşmesi — normalizeAd üstüne VEKÂLET eki temizliği.
 *
 * Personnel.birimSorumlusu/sorumlu2/sorumlu3 serbest metin alanları; saha
 * kullanımında vekâleten bakan kişi "V.BEDRİ GÜLER" ya da "YASİN ÜLGEN (V)"
 * diye yazılıyor. Bu yazımlar hiçbir Personnel.adSoyad'a eşleşmediği için
 * onaycı null dönüyordu (ölçüm 2026-09-01: 352 atamanın 49'u çözülemiyordu).
 *
 * AYRI EXPORT, çünkü normalizeAd org koltuk/görev eşleşmesinde de kullanılıyor
 * (koltuk-eslesme, pozisyon-secenekleri, GorevSecici, BolumSecici); oradaki
 * metinlerde tek harflik "V" token'ı anlamlı olabilir. Kural yine TEK
 * KAYNAKTA: adNormalize normalizeAd'i çağırır, kopyalamaz.
 */
export function adNormalize(input: string): string {
  const s = normalizeAd(input)
  if (!s) return ""
  const parcalar = s.split(" ")
  // Baştaki vekâlet öneki: "V." / "V " / "VK." → normalizeAd sonrası tek harflik token.
  while (parcalar.length > 1 && (parcalar[0] === "V" || parcalar[0] === "VK")) parcalar.shift()
  // Sondaki "(V)" soneki → normalizeAd parantezi boşluğa çevirdiği için son token "V".
  while (parcalar.length > 1 && parcalar[parcalar.length - 1] === "V") parcalar.pop()
  return parcalar.join(" ")
}
