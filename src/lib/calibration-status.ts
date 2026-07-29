import { CalibrationStatus } from '@/generated/prisma'

/**
 * Otomatik kalibrasyon/doğrulama durumu — referans tarihe (sonraki kalibrasyon veya
 * doğrulama) göre ÇİFT YÖNLÜ hesaplar:
 *   refDate geçmişte           → EXPIRED
 *   refDate ≤ now+30gün        → EXPIRING
 *   refDate gelecekte (>30gün) → VALID
 *
 * ⚠ Yalnız OTOMATİK durum içindir. Manuel override (IN_PROCESS / OUT_OF_ORDER,
 * statusManualOverride=true) çağıran tarafta KORUNUR — bu fonksiyon çağrılmaz.
 *
 * Tek yönlü eski mantık (yalnız VALID→EXPIRED, geri dönüş yok) periyot uzatılınca
 * EXPIRED'i takılı bırakıyordu; bu helper iki yeri (liste + update) tek kaynaktan besler.
 */
export function computeCalibrationStatus(refDate: Date, now: Date): CalibrationStatus {
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (refDate < now) return CalibrationStatus.EXPIRED
  if (refDate <= thirtyDaysFromNow) return CalibrationStatus.EXPIRING
  return CalibrationStatus.VALID
}
