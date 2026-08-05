/**
 * IFS ilerleme yüzdesi — ORTAK PAYDA hesabı (tek kaynak).
 *
 * KURAL (her ekranda AYNI payda):
 *   Payda = kullanıcıya atanmış toplam aktif GOREV − (o kullanıcının FARKLI_DEPARTMAN görevleri)
 *   FARKLI_DEPARTMAN → paydadan düşer (görev o kişiye ait değil)
 *   EGITIM_GEREKLI  → paydada KALIR, paya girmez (tamamlanmadı)
 *   Payda 0 → %0 "kapsam dışı" (%100 DEĞİL) + sıfıra bölme koruması
 *
 * ⚠ PAY (numerator) BİLEREK helper'a gömülMEZ — her ekran kendi payını verir:
 *   - Kurs kartı / kursiyer görünümü → ORNEK_YAPILDI (self-mark)
 *   - Bölüm raporu / agregat / PDF   → ornekStatus === BASARILI (eğitmen onayı)
 */

/** Ortak payda: toplam GOREV − FARKLI_DEPARTMAN (asla negatif değil). */
export function ifsPayda(
  toplamGorev: number,
  farkliDepartmanSayisi: number,
): number {
  return Math.max(0, toplamGorev - farkliDepartmanSayisi);
}

/**
 * IFS yüzdesi = pay / ifsPayda(...). Pay ÇAĞIRAN tarafından verilir (self-mark
 * veya BASARILI — ekrana göre). Payda 0 → %0. 0..100 arası, yuvarlanmış.
 */
export function ifsYuzde(
  pay: number,
  toplamGorev: number,
  farkliDepartmanSayisi: number,
): number {
  const payda = ifsPayda(toplamGorev, farkliDepartmanSayisi);
  if (payda <= 0) return 0; // kapsam dışı — %100 DEĞİL
  return Math.min(100, Math.round((pay / payda) * 100));
}
