/**
 * RMA/SMA liste filtresi — TEK KAYNAK sorgu kurucu (KAL-KYT-16).
 *
 * Liste ucu (GET /api/quality/rma) ve Excel export ucu
 * (GET /api/quality/rma/export) AYNI filtreyi kullansın diye buraya çıkarıldı;
 * iki uç ıraksamasın. Filtre: tip, musteriId, durum(acik|kapali),
 * from/to (irsaliyeTarihi), q (no | ürün kodu | müşteri adı).
 */
import { RmaTip, Prisma } from '@/generated/prisma'

export function buildRmaWhere(sp: URLSearchParams): Prisma.RmaKayitWhereInput {
  const where: Prisma.RmaKayitWhereInput = {}

  const tip = sp.get('tip')
  if (tip === 'RMA' || tip === 'SMA') where.tip = tip as RmaTip

  const musteriId = sp.get('musteriId')
  if (musteriId) where.musteriId = musteriId

  const durum = sp.get('durum')
  if (durum === 'acik') where.kapanisTarihi = null
  else if (durum === 'kapali') where.kapanisTarihi = { not: null }

  const from = sp.get('from')
  const to = sp.get('to')
  if (from || to) {
    where.irsaliyeTarihi = {}
    if (from) (where.irsaliyeTarihi as Prisma.DateTimeNullableFilter).gte = new Date(from)
    if (to) (where.irsaliyeTarihi as Prisma.DateTimeNullableFilter).lte = new Date(to)
  }

  const q = sp.get('q')?.trim()
  if (q) {
    const or: Prisma.RmaKayitWhereInput[] = [
      { satirlar: { some: { urunKodu: { contains: q, mode: 'insensitive' } } } },
      { musteri: { name: { contains: q, mode: 'insensitive' } } },
    ]
    const asNo = Number.parseInt(q, 10)
    if (Number.isInteger(asNo) && String(asNo) === q) or.push({ no: asNo })
    where.OR = or
  }

  return where
}
