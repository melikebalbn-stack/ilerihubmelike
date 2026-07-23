// Duruş yorumu — paylaşılan normalize yardımcıları.
//
// NEDEN LIB (route DEĞİL): Next.js App Router prod build'i (`next build`) route
// dosyalarından yalnız HTTP metodları + birkaç config alanının export edilmesine
// izin verir; helper export'u derlemeyi kırar (23.07.2026, commit 41bc0dc7 olayı).
// tsc/next dev/vitest bu kuralı denetlemez. Paylaşılan helper burada yaşar; hem
// durus-yorum/route.ts hem durus-basla/route.ts buradan import eder (tek doğruluk kaynağı).

export const YORUM_MAX = 200

/**
 * Duruş yorumunu normalize eder: trim + üst sınır. Boş/whitespace → null.
 */
export function yorumNormalize(ham: unknown): string | null {
  if (typeof ham !== 'string') return null
  const t = ham.trim()
  if (!t) return null
  return t.slice(0, YORUM_MAX)
}
