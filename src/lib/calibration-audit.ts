import type { CalibrationDevice, CalibrationHistory } from '@/generated/prisma'

/**
 * Kalibrasyon alan bazlı değişiklik izi (ISO 9001 7.1.5.2 / ISO 27001).
 *
 * NEDEN: CalibrationDevice.updatedById yalnız SON değiştireni tutar ve ikinci
 * düzenleme birinciyi ezer. Denetçinin sorusu ise "periyot 180→365'e ne zaman,
 * kim tarafından çıkarıldı" — bunun için alanın eski/yeni değeri gerekir.
 *
 * NEREYE: yeni tablo AÇILMAZ; mevcut permission_audit_log'a logAuditEvent ile
 * yazılır (JOB_APPLICATION_UPDATED deseninin aynısı: details.degisiklikler).
 *
 * NE İZLENİR: yalnız ISO açısından anlamlı alanlar. notes/imageUrl/attachments
 * ve marka-model gibi tanımlayıcılar KAPSAM DIŞI (gürültü yapar, karar değiştirmez).
 */
export type AlanDegisikligi = { alan: string; etiket: string; eski: string | null; yeni: string | null }

/** İzlenen cihaz alanları — etiketler denetim çıktısında okunur olsun diye Türkçe. */
const CIHAZ_ALANLARI: { alan: keyof CalibrationDevice; etiket: string }[] = [
  { alan: 'calibrationInterval', etiket: 'Kalibrasyon periyodu (gün)' },
  { alan: 'verificationInterval', etiket: 'Doğrulama periyodu (gün)' },
  { alan: 'lastCalibrationDate', etiket: 'Son kalibrasyon tarihi' },
  { alan: 'nextCalibrationDate', etiket: 'Sonraki kalibrasyon tarihi' },
  { alan: 'plannedCalibrationDate', etiket: 'Planlanan kalibrasyon tarihi' },
  { alan: 'lastVerificationDate', etiket: 'Son doğrulama tarihi' },
  { alan: 'nextVerificationDate', etiket: 'Sonraki doğrulama tarihi' },
  { alan: 'plannedVerificationDate', etiket: 'Planlanan doğrulama tarihi' },
  { alan: 'status', etiket: 'Durum' },
  { alan: 'statusManualOverride', etiket: 'Durum manuel override' },
  { alan: 'deviceCondition', etiket: 'Cihaz durumu' },
  { alan: 'scrapDate', etiket: 'Hurda tarihi' },
  { alan: 'department', etiket: 'Departman' },
  { alan: 'productionSection', etiket: 'Üretim bölümü' },
  { alan: 'responsiblePerson', etiket: 'Zimmet sorumlusu' },
  { alan: 'calibrationType', etiket: 'Kalibrasyon tipi' },
  { alan: 'isActive', etiket: 'Aktif' },
]

/** Kalibrasyon geçmişi düzenlemesinde İZLENEN alanlar — sonuç değişikliği kritiktir. */
const GECMIS_ALANLARI: { alan: keyof CalibrationHistory; etiket: string }[] = [
  { alan: 'calibrationDate', etiket: 'Kalibrasyon tarihi' },
  { alan: 'nextDueDate', etiket: 'Sonraki vade' },
  { alan: 'result', etiket: 'Sonuç' },
  { alan: 'certificateNumber', etiket: 'Sertifika no' },
  { alan: 'calibratedBy', etiket: 'Kalibre eden firma' },
  { alan: 'cost', etiket: 'Maliyet' },
]

/** Tarih/Decimal/null farklarını yanlış pozitif üretmeden metne çevirir. */
function metin(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'boolean') return v ? 'evet' : 'hayır'
  return String(v)
}

function diffle<T>(
  alanlar: { alan: keyof T; etiket: string }[],
  once: T,
  sonra: T,
): AlanDegisikligi[] {
  const out: AlanDegisikligi[] = []
  for (const { alan, etiket } of alanlar) {
    const eski = metin(once[alan])
    const yeni = metin(sonra[alan])
    if (eski !== yeni) out.push({ alan: String(alan), etiket, eski, yeni })
  }
  return out
}

export function kalibrasyonAlanDiff(once: CalibrationDevice, sonra: CalibrationDevice): AlanDegisikligi[] {
  return diffle(CIHAZ_ALANLARI, once, sonra)
}

export function kalibrasyonGecmisAlanDiff(once: CalibrationHistory, sonra: CalibrationHistory): AlanDegisikligi[] {
  return diffle(GECMIS_ALANLARI, once, sonra)
}
