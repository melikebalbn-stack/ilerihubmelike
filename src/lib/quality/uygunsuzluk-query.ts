/**
 * Uygunsuzluk liste filtresi — TEK KAYNAK sorgu kurucu (KAL-KYT-15 Bölüm 2).
 *
 * Liste ucu (GET /api/quality/uygunsuzluk) ve ileride eklenecek Excel export ucu
 * AYNI filtreyi kullansın diye buraya çıkarıldı; iki uç ıraksamasın
 * (rma-query.ts'teki gerekçenin aynısı).
 *
 * Filtre: isEmriNo, mamulUrunKodu, tespitEdenBolumId, durum(acik|kapali),
 *         from/to (tarih), q (no | iş emri no | mamul ürün kodu).
 */
import { Prisma } from '@/generated/prisma'

export function buildUygunsuzlukWhere(sp: URLSearchParams): Prisma.KaliteUygunsuzlukWhereInput {
  const where: Prisma.KaliteUygunsuzlukWhereInput = {}

  const isEmriNo = sp.get('isEmriNo')?.trim()
  if (isEmriNo) where.isEmriNo = { contains: isEmriNo, mode: 'insensitive' }

  const mamulUrunKodu = sp.get('mamulUrunKodu')?.trim()
  if (mamulUrunKodu) where.mamulUrunKodu = { contains: mamulUrunKodu, mode: 'insensitive' }

  const bolumId = sp.get('tespitEdenBolumId')
  if (bolumId) where.tespitEdenBolumId = bolumId

  const durum = sp.get('durum')
  if (durum === 'acik') where.kapanisTarihi = null
  else if (durum === 'kapali') where.kapanisTarihi = { not: null }

  const from = sp.get('from')
  const to = sp.get('to')
  if (from || to) {
    where.tarih = {}
    if (from) (where.tarih as Prisma.DateTimeFilter).gte = new Date(from)
    if (to) (where.tarih as Prisma.DateTimeFilter).lte = new Date(to)
  }

  const q = sp.get('q')?.trim()
  if (q) {
    const or: Prisma.KaliteUygunsuzlukWhereInput[] = [
      { isEmriNo: { contains: q, mode: 'insensitive' } },
      { mamulUrunKodu: { contains: q, mode: 'insensitive' } },
    ]
    const asNo = Number.parseInt(q, 10)
    if (Number.isInteger(asNo) && String(asNo) === q) or.push({ no: asNo })
    where.OR = or
  }

  return where
}
