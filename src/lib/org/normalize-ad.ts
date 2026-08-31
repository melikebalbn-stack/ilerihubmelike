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
