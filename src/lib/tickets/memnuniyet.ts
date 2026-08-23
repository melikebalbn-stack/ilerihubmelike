// IT Ticket — memnuniyet puanlaması kuralları (SAF: prisma yok, now dışarıdan).
//
// Aynı kurallar hem sunucuda (yetki/doğrulama) hem UI'da (kartı göster/gizle)
// kullanılır. UI'ya ASLA güvenilmez — sunucu bu fonksiyonları tekrar çağırır.
//
// SAHİPLİK: Ticket'ta `createdById` YOK; sahip `requesterEmail` ile belirlenir
// (mevcut `isOwner` deseniyle aynı). E-posta değişirse sahiplik kopar —
// bilinen borç, ayrı iş olarak backlog'da (requesterId kolonu).

export const PUANLANABILIR_DURUMLAR = ['RESOLVED', 'CLOSED'] as const

/** Kapanıştan sonra puanlama penceresi. */
export const PUANLAMA_PENCERESI_GUN = 14

export const PUAN_MIN = 1
export const PUAN_MAX = 5

export interface MemnuniyetGirdisi {
  requesterEmail: string
  status: string
  /** Kapanış zamanı; yoksa çözüm zamanına düşülür. */
  closedAt: Date | null
  resolvedAt: Date | null
  satisfactionRating: number | null
}

export type RedSebebi =
  | 'sahip_degil'
  | 'durum_uygun_degil'
  | 'zaten_puanlandi'
  | 'pencere_kapandi'
  | 'kapanis_zamani_yok'

export interface MemnuniyetKarari {
  puanlayabilir: boolean
  sebep: RedSebebi | null
  /** Pencerenin dayandığı an (closedAt ?? resolvedAt). */
  referansAn: Date | null
  /** Kalan gün (pozitifse puanlanabilir) — UI'da "X gün kaldı" için. */
  kalanGun: number | null
}

function esitEposta(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? '').toLowerCase().trim()
  const y = (b ?? '').toLowerCase().trim()
  return x !== '' && x === y
}

/**
 * Pencere referansı: kapanış varsa closedAt, yoksa resolvedAt.
 * Ticket RESOLVED'da takılıp hiç CLOSED olmadıysa saat çözüm anından işler.
 * İkisi de null ise pencere hesaplanamaz → puanlama kapalı.
 */
export function referansAni(t: Pick<MemnuniyetGirdisi, 'closedAt' | 'resolvedAt'>): Date | null {
  return t.closedAt ?? t.resolvedAt ?? null
}

/**
 * Bu kullanıcı bu ticket'ı ŞU AN puanlayabilir mi?
 *
 * Sıra önemli: en spesifik ret sebebi önce döner ki çağıran doğru HTTP
 * kodunu seçebilsin (sahip değil → 403, zaten puanlandı → 409 …).
 */
export function puanlayabilirMi(
  t: MemnuniyetGirdisi,
  kullaniciEpostasi: string | null | undefined,
  now: Date,
): MemnuniyetKarari {
  const referansAn = referansAni(t)
  const bos = { puanlayabilir: false, referansAn, kalanGun: null as number | null }

  if (!esitEposta(t.requesterEmail, kullaniciEpostasi)) {
    return { ...bos, sebep: 'sahip_degil' }
  }
  if (!(PUANLANABILIR_DURUMLAR as readonly string[]).includes(t.status)) {
    return { ...bos, sebep: 'durum_uygun_degil' }
  }
  if (t.satisfactionRating !== null && t.satisfactionRating !== undefined) {
    return { ...bos, sebep: 'zaten_puanlandi' }
  }
  if (referansAn === null) {
    return { ...bos, sebep: 'kapanis_zamani_yok' }
  }

  const gecenMs = now.getTime() - referansAn.getTime()
  const pencereMs = PUANLAMA_PENCERESI_GUN * 24 * 60 * 60 * 1000
  if (gecenMs > pencereMs) {
    return { ...bos, sebep: 'pencere_kapandi', kalanGun: 0 }
  }

  return {
    puanlayabilir: true,
    sebep: null,
    referansAn,
    kalanGun: Math.max(0, Math.ceil((pencereMs - gecenMs) / (24 * 60 * 60 * 1000))),
  }
}

/** Puan geçerli bir tam sayı mı (1-5)? */
export function gecerliPuan(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= PUAN_MIN && v <= PUAN_MAX
}

/** Ret sebebi → HTTP durum kodu (tek kaynak, uçlar bunu kullanır). */
export function redHttpKodu(sebep: RedSebebi): number {
  switch (sebep) {
    case 'sahip_degil':
      return 403
    case 'zaten_puanlandi':
      return 409
    case 'durum_uygun_degil':
    case 'pencere_kapandi':
    case 'kapanis_zamani_yok':
    default:
      return 400
  }
}

export const RED_MESAJLARI: Record<RedSebebi, string> = {
  sahip_degil: 'Yalnızca talebi açan kişi değerlendirme yapabilir',
  durum_uygun_degil: 'Yalnızca çözülmüş veya kapatılmış talepler değerlendirilebilir',
  zaten_puanlandi: 'Bu talep zaten değerlendirilmiş',
  pencere_kapandi: `Değerlendirme süresi doldu (${PUANLAMA_PENCERESI_GUN} gün)`,
  kapanis_zamani_yok: 'Talebin kapanış zamanı bulunamadı',
}
