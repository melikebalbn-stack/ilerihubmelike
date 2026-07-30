// IPRO fiziksel aktivite katmanı — poller /status'ten canlı çalışıyor/duruşta türetimi.
//
// PAYLAŞIMLI: hem fabrika haritası (/ipro/harita/durum) hem izleme panosu (izleme-service)
// buradan beslenir → TEK /status okuma deseni + TEK hareket-durumu haritası (drift yok).
//
// SINIR (net): "çalışıyor" PLC SAYAÇ HAREKETİNDEN gelir (yeşil canlanır). "duruşta"nın
// PLC duruş bitinden gelmesi mantığı DURUR ama duruş biti sahada hiç 1 olmuyor (0/214) →
// pratikte fiziksel 'durusta' ÖLÜ dal. Çağıranlar "duruşta"yı KİOSK duruş kaydından türetir.
// Duruş bitinin otomatik gelmesi AYRI SAHA İŞİ (PLC bit set etmiyor — adres/wiring).

const POLLER_BASE = `http://127.0.0.1:${process.env.IPRO_POLLER_PORT ?? 3020}`
const POLLER_TIMEOUT_MS = 1_500
// Son sayaç hareketinden bu yana bu süre içinde ise "calisiyor". Çevrim 5sn'den uzun
// tezgahlar var; tek turda delta=0 "durdu" DEĞİL — pencere bunun için (sonDelta değil, DEĞİŞİM).
export const HAREKET_PENCERESI_MS = 180_000

/** Fiziksel katmanın ürettiği durum. 'bosta' ayrımı çağırana bırakılır (null = /status'te yok/hareketsiz). */
export type FizikselDurum = 'calisiyor' | 'durusta'

export type StatusHaritasi = Map<string, { sayacToplam: number; durusta: boolean }>

type PollerStatusSatiri = { tezgahKod?: string; sayacToplam?: unknown; durusta?: unknown }

/**
 * Poller /status'ü çeker → tezgahKod → {sayacToplam, durusta}. Hata/timeout → null
 * (fiziksel katman ATLANIR, çağıran mevcut davranışına düşer — pano/harita yine açılır).
 */
export async function statusCek(): Promise<StatusHaritasi | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), POLLER_TIMEOUT_MS)
  try {
    const res = await fetch(`${POLLER_BASE}/status`, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    const list = (await res.json()) as PollerStatusSatiri[]
    if (!Array.isArray(list)) return null
    const m: StatusHaritasi = new Map()
    for (const s of list) {
      if (typeof s.tezgahKod !== 'string') continue
      m.set(s.tezgahKod, {
        sayacToplam: typeof s.sayacToplam === 'number' ? s.sayacToplam : 0,
        durusta: s.durusta === true,
      })
    }
    return m
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// Modül düzeyinde (istekler arası yaşar, Next node runtime): tezgahKod → son görülen sayaç +
// son hareket zamanı. Harita + izleme AYNI haritayı paylaşır (tek doğruluk, çift settle yok).
const hareketByKod = new Map<string, { sayac: number; sonHareketTs: number }>()

/**
 * Bir tezgahın fiziksel durumu (poller sayaç hareketi + duruş biti). SALT OKUMA + module state.
 * @returns 'calisiyor' | 'durusta' | null (null = /status'te yok VEYA hareketsiz → çağıran 'bosta' yapar)
 *
 * İlk görülüşte hareket referansı yoktur → o istek null döner, sonraki poll'da oturur (kabul).
 * @param statusByKod statusCek() sonucu; null ise (poller down) daima null döner.
 */
export function fizikselDurum(tezgahKod: string, statusByKod: StatusHaritasi | null): FizikselDurum | null {
  if (!statusByKod) return null
  const s = statusByKod.get(tezgahKod)
  if (!s) return null // bayat/sinyalsiz → /status'te yok
  if (s.durusta) return 'durusta' // ÖLÜ dal (bit 0/214) ama mantık korunur
  const now = Date.now()
  const prev = hareketByKod.get(tezgahKod)
  if (!prev) {
    // İlk görülüş: referans yok → bu istekte null, sonrakinde oturur.
    hareketByKod.set(tezgahKod, { sayac: s.sayacToplam, sonHareketTs: 0 })
    return null
  }
  const sonHareketTs = s.sayacToplam > prev.sayac ? now : prev.sonHareketTs
  hareketByKod.set(tezgahKod, { sayac: s.sayacToplam, sonHareketTs })
  return sonHareketTs && now - sonHareketTs < HAREKET_PENCERESI_MS ? 'calisiyor' : null
}
