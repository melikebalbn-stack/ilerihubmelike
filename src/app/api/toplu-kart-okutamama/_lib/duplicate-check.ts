import { prisma } from '@/lib/prisma'

const DUPLICATE_WINDOW_MINUTES = 5

function toMinutes(saat: string | null): number | null {
  if (!saat) return null
  const [h, m] = saat.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function withinWindow(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) <= DUPLICATE_WINDOW_MINUTES
}

/**
 * Aynı personel + aynı gün için, giriş VE çıkış saati mevcut bir kayıtla
 * ±5 dakika içinde çakışan kayıt var mı kontrol eder (mükerrer kayıt engeli).
 * O gün için hiç kayıt yoksa (veya saatler karşılaştırılamıyorsa) engel yok.
 */
export async function hasDuplicateRecord(params: {
  personnelId: string
  tarih: Date
  girisSaati: string | null
  cikisSaati: string | null
  excludeId?: string
}): Promise<boolean> {
  const { personnelId, tarih, girisSaati, cikisSaati, excludeId } = params

  const dayStart = new Date(Date.UTC(tarih.getUTCFullYear(), tarih.getUTCMonth(), tarih.getUTCDate()))
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const existing = await prisma.bulkCardScanFailure.findMany({
    where: {
      personnelId,
      tarih: { gte: dayStart, lt: dayEnd },
      // Reddedilmiş bir kayıt mükerrer sayılmaz — SELF akışında red sonrası
      // aynı gün için düzeltilmiş yeniden gönderim engellenmemeli.
      onayDurumu: { not: 'REDDEDILDI' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { girisSaati: true, cikisSaati: true },
  })

  const newGiris = toMinutes(girisSaati)
  const newCikis = toMinutes(cikisSaati)

  return existing.some(
    (r) => withinWindow(toMinutes(r.girisSaati), newGiris) && withinWindow(toMinutes(r.cikisSaati), newCikis)
  )
}

export const DUPLICATE_ERROR_MESSAGE =
  'Bu personel için aynı gün, girişi/çıkışı çok yakın (±5 dk) bir kayıt zaten var — mükerrer kayıt oluşturulamaz'
