/**
 * IT Ticket — çözüm akışı kuralları (SAF: prisma yok, now dışarıdan).
 *
 * TEK AKIŞ: bir talebi "çözüldü" yapmanın tek yolu POST /api/tickets/[id]/cozum.
 * Eskiden iki yol vardı — `isResolution` yorumu ve PUT ile doğrudan
 * `status: 'RESOLVED'` — ikisi de farklı alanları dolduruyordu (biri
 * resolutionSummary yazıyor, öbürü yazmıyordu) ve ikisi de bu dosyadaki
 * damgaları (resolvedBy*, autoCloseAt) hiç bilmiyordu. Faz 1'de ikisi de
 * kapatıldı; kural burada tek kaynakta.
 *
 * DURUM SÖZLÜĞÜ (yeni enum değeri EKLENMEDİ):
 *   RESOLVED    = çözüldü, kullanıcı onayı bekleniyor
 *   CLOSED      = kapandı (kullanıcı onayladı VEYA süre sessizce doldu)
 *   IN_PROGRESS = kullanıcı "sorun devam ediyor" dedi, iş geri açıldı
 */

/** Kullanıcının itiraz penceresi. Süre değişirse YALNIZ burası değişir. */
export const ITIRAZ_SURESI_GUN = 3

/**
 * Tek cron turunda kapatılabilecek azami talep. Aşılırsa HİÇBİRİ kapanmaz ve
 * alarm gider — `deaktive-ayrilan-personel` cron'undaki kalıbın aynısı.
 * Gerekçe: toplu kapanma sessizce olursa fark edilmesi günler alır; durup
 * haber vermek, yanlışlıkla 200 talebi kapatmaktan iyidir.
 */
export const AZAMI_TOPLU_KAPANIS = 10

/** Alarm maili buraya gider (cron güvenlik ağı devreye girdiğinde). */
export const ALARM_EPOSTASI = 'melih.dilben@ilerigroup.com'

/** Çözüm anından itibaren otomatik kapanma anı. */
export function otomatikKapanmaAni(cozumAni: Date, gun: number = ITIRAZ_SURESI_GUN): Date {
  return new Date(cozumAni.getTime() + gun * 24 * 60 * 60 * 1000)
}

/** Bu durumdan "çözüldü"ye geçilebilir mi? */
export function cozulebilirMi(status: string): boolean {
  return status !== 'RESOLVED' && status !== 'CLOSED' && status !== 'CANCELLED'
}

/** Kullanıcı onayı/itirazı yalnız RESOLVED'da anlamlı. */
export function onayBekliyorMu(status: string): boolean {
  return status === 'RESOLVED'
}

/** Kalan itiraz süresi (gün, yukarı yuvarlanmış). Süre dolduysa 0. */
export function kalanItirazGunu(autoCloseAt: Date | null, now: Date): number | null {
  if (!autoCloseAt) return null
  const fark = autoCloseAt.getTime() - now.getTime()
  return fark <= 0 ? 0 : Math.ceil(fark / (24 * 60 * 60 * 1000))
}
