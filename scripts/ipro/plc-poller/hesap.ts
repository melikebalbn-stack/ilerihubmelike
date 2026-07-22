/**
 * IPRO PLC Poller — SAF hesap fonksiyonları.
 *
 * PLC/DB/ağ DOKUNMAZ: girdi→çıktı, yan etkisiz. index.ts bunları import eder;
 * testler (hesap.test.ts) canlı PLC olmadan bu dosyayı hedefler.
 *
 * PLC'ye YAZMA YOK (resetAdresi dahil) — poller yalnız okur.
 */

// ── Sayaç ──

export interface SayacSonuc {
  /** Bu turdaki üretim artışı (asla negatif). */
  delta: number
  /** PLC sayacı sıfırlanmış mı (cur < prev). */
  resetMi: boolean
}

/**
 * İki okuma arasındaki sayaç deltası.
 *
 * WRAP BRANCH'İ BİLİNÇLİ OLARAK YOK (gündüz sonda kanıtı, 22.07.2026):
 * sahada görülen en yüksek sayaç 3997 — DWORD_MAX'ın (4 294 967 296) yalnızca
 * %0.0001'i. Sayaçlar wrap eşiğine YAKLAŞMADAN zaten sıfırlanıyor
 * (kanıt: CN14 prev=1 → cur=0, ardından 1, 2 diye yeniden saymaya başladı).
 * Bu yüzden `cur < prev` durumu WRAP değil, RESET olarak yorumlanır.
 * Wrap gerçekten mümkün olsaydı ayrı bir branch gerekirdi; veri onu göstermiyor.
 *
 * Reset + aynı turda üretim: prev=500, cur=3 → reset olmuş VE 3 adet üretilmiş
 * demektir; delta = cur = 3 (üretim kaybedilmez).
 *
 * @param prev önceki okuma; undefined ise bu ilk turdur
 * @param cur  şimdiki okuma (DWORD big-endian, ham)
 */
export function sayacDelta(prev: number | undefined, cur: number): SayacSonuc {
  // İlk tur: baseline kurulur, delta sayılmaz (aksi halde tüm birikmiş sayaç
  // tek turda "üretim" gibi görünürdü).
  if (prev === undefined) return { delta: 0, resetMi: false }

  if (cur >= prev) return { delta: cur - prev, resetMi: false }

  // cur < prev → RESET (yukarıdaki gerekçe). Sıfırlama sonrası okunan değer,
  // sıfırlamadan bu yana üretilen adettir.
  const delta = cur < 0 ? 0 : cur
  return { delta, resetMi: true }
}

// ── Duruş ──

export type DurusGecis = 'basladi' | 'bitti' | null

/**
 * Duruş bitinin (durusAdresi byte'ının 0. biti) tur-arası geçişi.
 * İlk turda (prev undefined) geçiş ÜRETİLMEZ — baseline sayılır.
 */
export function durusGecis(prevBit: boolean | undefined, curBit: boolean): DurusGecis {
  if (prevBit === undefined) return null
  if (!prevBit && curBit) return 'basladi'
  if (prevBit && !curBit) return 'bitti'
  return null
}

// ── Tezgah toplama ──

export interface PinOzet {
  /** Tezgaha bağlı değilse null — toplamaya GİRMEZ. */
  tezgahKod: string | null
  curSayac: number
  lastDelta: number
  durusBit: boolean
}

export interface TezgahToplam {
  /** Tezgahın tüm pinlerinin ham sayaç toplamı (is-basla sözleşmesi bunu okur). */
  sayacToplam: number
  /** Bu turdaki delta toplamı. */
  sonDelta: number
  /** Herhangi bir pini duruş sinyali veriyorsa tezgah duruşta sayılır. */
  durusta: boolean
}

/**
 * Pin durumlarını tezgah bazında toplar. Bir tezgahın birden çok pini olabilir
 * (üretim = TÜM pinlerinin deltaları toplamı).
 */
export function aggregateTezgah(pins: PinOzet[]): Map<string, TezgahToplam> {
  const sonuc = new Map<string, TezgahToplam>()
  for (const p of pins) {
    if (!p.tezgahKod) continue // tezgaha bağlı olmayan pin toplamaya girmez
    const t = sonuc.get(p.tezgahKod) ?? { sayacToplam: 0, sonDelta: 0, durusta: false }
    t.sayacToplam += p.curSayac
    t.sonDelta += p.lastDelta
    if (p.durusBit) t.durusta = true
    sonuc.set(p.tezgahKod, t)
  }
  return sonuc
}
