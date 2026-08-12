import type { YillikTakvimPeriyot } from '@/generated/prisma'

const DAY = 86_400_000
const DAY_OFFSETS: Partial<Record<YillikTakvimPeriyot, number>> = {
  GUNLUK: 1,
  HAFTALIK: 7,
  IKI_HAFTADA_BIR: 14,
}
const MONTH_OFFSETS: Partial<Record<YillikTakvimPeriyot, number>> = {
  AYLIK: 1,
  IKI_AYDA_BIR: 2,
  UC_AYLIK: 3,
  ALTI_AYLIK: 6,
}
const YEAR_OFFSETS: Partial<Record<YillikTakvimPeriyot, number>> = {
  YILLIK: 1,
  IKI_YILDA_BIR: 2,
  UC_YILDA_BIR: 3,
}

export function sonrakiDonemTarihi(tarih: Date | null, periyot: YillikTakvimPeriyot): Date | null {
  if (!tarih) return null
  const dayOffset = DAY_OFFSETS[periyot]
  if (dayOffset) return new Date(tarih.getTime() + dayOffset * DAY)
  const monthOffset = MONTH_OFFSETS[periyot]
  if (monthOffset) {
    const result = new Date(tarih)
    result.setUTCMonth(result.getUTCMonth() + monthOffset)
    return result
  }
  const yearOffset = YEAR_OFFSETS[periyot]
  if (yearOffset) {
    const result = new Date(tarih)
    result.setUTCFullYear(result.getUTCFullYear() + yearOffset)
    return result
  }
  return null
}

export function sonrakiDonemHesaplanabilir(periyot: YillikTakvimPeriyot): boolean {
  return periyot in DAY_OFFSETS || periyot in MONTH_OFFSETS || periyot in YEAR_OFFSETS
}
