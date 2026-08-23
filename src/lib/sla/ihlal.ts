// IT Ticket SLA — ihlal KARARI + DURAKLATMA (saf: prisma yok).
//
// TEK KAYNAK: ihlal hesabı yalnız burada. Cron ucu, ticket PUT'u ve yorum ucu
// bu fonksiyonları çağırır; formül hiçbir yerde kopyalanmaz.
//
// Faz 1d: PENDING/ON_HOLD'da SLA saati DURUR.
//   - Hedef tarih (responseDueAt/resolutionDueAt) KAYDIRILMAZ — denetim izi
//     olarak sabit kalır; duraklatma karşılaştırma anında düşülür.
//   - Birikim İŞ dakikası cinsindendir: hafta sonu PENDING'de bekleyen bir
//     ticket zaten iş saati işlemediği için çift sayılmaz.

import type { IproTatilTip } from '@/lib/ipro/takvim-util'
import { businessMinutesBetween, type SlaCalismaAyari } from './calisma-takvimi'

/** Kapalı sayılan durumlar — bunlarda SLA saati işlemez. */
export const KAPALI_DURUMLAR = ['RESOLVED', 'CLOSED', 'CANCELLED'] as const

/** SLA saatini DURDURAN durumlar. */
export const DURAKLATAN_DURUMLAR = ['PENDING', 'ON_HOLD'] as const

export function duraklatiyorMu(status: string): boolean {
  return (DURAKLATAN_DURUMLAR as readonly string[]).includes(status)
}

export function kapaliMi(status: string): boolean {
  return (KAPALI_DURUMLAR as readonly string[]).includes(status)
}

/** Takvim bağlamı — DB'den okunur, saf katmana parametre olarak geçer. */
export interface TakvimBaglami {
  tatilMap: Map<string, IproTatilTip>
  ayar: SlaCalismaAyari
}

// ── Duraklatma ──────────────────────────────────────────────────────────────

export interface DuraklatmaAlanlari {
  slaPausedAt: Date | null
  slaPausedMinutes: number
}

/**
 * Şu ana kadar birikmiş TOPLAM duraklatma (iş dakikası).
 * Halen duraklatmadaysa, süregelen aralık da eklenir.
 */
export function toplamDuraklatma(t: DuraklatmaAlanlari, now: Date, b: TakvimBaglami): number {
  const biriken = Number.isFinite(t.slaPausedMinutes) ? Math.max(0, t.slaPausedMinutes) : 0
  if (t.slaPausedAt === null) return biriken
  return biriken + businessMinutesBetween(t.slaPausedAt, now, b.tatilMap, b.ayar)
}

export interface DuraklatmaGecisi {
  /** Ticket update'ine eklenecek alanlar (boşsa değişiklik yok). */
  guncelleme: Partial<DuraklatmaAlanlari>
  /** Timeline'a düşecek olay (yoksa null). */
  olay: 'sla_paused' | 'sla_resumed' | null
  /** Bu geçişte kapanan aralık (iş dakikası) — timeline metni için. */
  kapananDk: number
}

/**
 * Durum geçişinde duraklatma alanlarının nasıl değişeceği.
 *
 *   duraklatmayan → duraklatan : slaPausedAt = now
 *   duraklatan → duraklatmayan : birikim kapanır, slaPausedAt = null
 *   duraklatan → duraklatan    : DEĞİŞMEZ (PENDING→ON_HOLD çift saymaz)
 *   duraklatan → KAPALI        : birikim kapanır (aynı formül)
 *
 * Not: kapalı durumlar da "duraklatmayan" sayılır, bu yüzden RESOLVED/CLOSED'a
 * geçiş ayrı bir dal gerektirmez — aynı kapanış kolundan geçer.
 */
export function duraklatmaGecisi(
  eskiStatus: string,
  yeniStatus: string,
  mevcut: DuraklatmaAlanlari,
  now: Date,
  b: TakvimBaglami,
): DuraklatmaGecisi {
  const eskiDur = duraklatiyorMu(eskiStatus)
  const yeniDur = duraklatiyorMu(yeniStatus)

  // Duraklatan → duraklatan: dokunma (slaPausedAt korunur).
  if (eskiDur && yeniDur) return { guncelleme: {}, olay: null, kapananDk: 0 }

  // Duraklatmayan → duraklatan: saati durdur.
  if (!eskiDur && yeniDur) {
    // Zaten damga varsa ezme — tutarsız veride ikinci kez başlatmak
    // birikimi kaybettirirdi.
    if (mevcut.slaPausedAt !== null) return { guncelleme: {}, olay: null, kapananDk: 0 }
    return { guncelleme: { slaPausedAt: now }, olay: 'sla_paused', kapananDk: 0 }
  }

  // Duraklatan → duraklatmayan (kapalı dahil): birikimi kapat.
  if (eskiDur && !yeniDur) {
    if (mevcut.slaPausedAt === null) return { guncelleme: {}, olay: null, kapananDk: 0 }
    const kapananDk = businessMinutesBetween(mevcut.slaPausedAt, now, b.tatilMap, b.ayar)
    const biriken = Number.isFinite(mevcut.slaPausedMinutes) ? Math.max(0, mevcut.slaPausedMinutes) : 0
    return {
      guncelleme: { slaPausedAt: null, slaPausedMinutes: biriken + kapananDk },
      olay: 'sla_resumed',
      kapananDk,
    }
  }

  return { guncelleme: {}, olay: null, kapananDk: 0 }
}

// ── İhlal kararı ────────────────────────────────────────────────────────────

export interface IhlalGirdisi extends DuraklatmaAlanlari {
  status: string
  respondedAt: Date | null
  resolvedAt: Date | null
  responseDueAt: Date | null
  resolutionDueAt: Date | null
  slaResponseBreached: boolean
  slaResolutionBreached: boolean
}

export interface IhlalKarari {
  yanitIhlali: boolean
  cozumIhlali: boolean
  /** Duraklatma düşüldükten sonraki gecikme (iş dk). Pozitifse ihlal. */
  yanitGecikmeDk: number
  cozumGecikmeDk: number
  /** Bu taramada düşülen toplam duraklatma (iş dk) — dry-run/log için. */
  duraklatmaDk: number
  atlamaSebebi: string | null
}

/**
 * ETKİN GECİKME = businessMinutesBetween(hedef, now) − toplamDuraklatma
 *
 * Bu formül duraklatmanın hedeften ÖNCE mi sonra mı olduğuna bakmaz ve yine de
 * doğrudur: hedef zaten "açılış + bütçe" olduğundan
 *   bm(hedef, now) − duraklatma = (aktif geçen süre) − bütçe
 * Halen duraklatmadaysa iki terim aynı hızda büyür → gecikme donar.
 *
 * Duraklatma YANIT SLA'sını da etkiler: PENDING'e alınan bir ticket'ta IT henüz
 * yanıt vermemiş olabilir ve top kullanıcıdadır.
 */
export function ihlalDegerlendir(t: IhlalGirdisi, now: Date, b: TakvimBaglami): IhlalKarari {
  const bos: IhlalKarari = {
    yanitIhlali: false, cozumIhlali: false,
    yanitGecikmeDk: 0, cozumGecikmeDk: 0, duraklatmaDk: 0,
    atlamaSebebi: null,
  }

  if (kapaliMi(t.status)) return { ...bos, atlamaSebebi: `kapalı durum (${t.status})` }

  if (t.responseDueAt === null && t.resolutionDueAt === null) {
    return { ...bos, atlamaSebebi: 'SLA hedefi yok (motor öncesi kayıt)' }
  }

  const duraklatmaDk = toplamDuraklatma(t, now, b)

  const gecikme = (hedef: Date | null): number => {
    if (hedef === null) return 0
    return businessMinutesBetween(hedef, now, b.tatilMap, b.ayar) - duraklatmaDk
  }

  const yanitGecikmeDk = t.respondedAt === null ? gecikme(t.responseDueAt) : 0
  const cozumGecikmeDk = t.resolvedAt === null ? gecikme(t.resolutionDueAt) : 0

  const yanitIhlali = !t.slaResponseBreached && t.respondedAt === null && yanitGecikmeDk > 0
  const cozumIhlali = !t.slaResolutionBreached && t.resolvedAt === null && cozumGecikmeDk > 0

  if (!yanitIhlali && !cozumIhlali) {
    const sebep = duraklatiyorMu(t.status)
      ? `duraklatmada (${t.status}) — saat işlemiyor`
      : 'ihlal yok veya zaten işaretli'
    return { ...bos, yanitGecikmeDk, cozumGecikmeDk, duraklatmaDk, atlamaSebebi: sebep }
  }

  return { yanitIhlali, cozumIhlali, yanitGecikmeDk, cozumGecikmeDk, duraklatmaDk, atlamaSebebi: null }
}

/** Timeline/bildirim metni için kısa etiket. */
export function ihlalEtiketi(k: { yanitIhlali: boolean; cozumIhlali: boolean }): string {
  if (k.yanitIhlali && k.cozumIhlali) return 'Yanıt ve çözüm SLA süresi aşıldı'
  if (k.yanitIhlali) return 'Yanıt SLA süresi aşıldı'
  return 'Çözüm SLA süresi aşıldı'
}
