/**
 * Uygunsuzluk liste filtresi — TEK KAYNAK sorgu kurucu (KAL-KYT-15 Bölüm 2).
 *
 * Liste ucu (GET /api/quality/uygunsuzluk) ve ileride eklenecek Excel export ucu
 * AYNI filtreyi kullansın diye buraya çıkarıldı; iki uç ıraksamasın
 * (rma-query.ts'teki gerekçenin aynısı).
 *
 * Filtre: isEmriNo, mamulUrunKodu, musteriAdi, tespitEdenBolumId, kategoriId,
 *         durum(acik|devam|kapali), from/to (tarih), q (no | iş emri no | mamul
 *         ürün kodu | müşteri adı).
 *
 * `durum` DEVAM_EDIYOR hesaplaması `hesaplaDurum()` ile AYNI alan kümesini
 * kontrol eder (uygunsuzluk-labels.ts — TEK KAYNAK, ıraksamasın).
 * Birden fazla OR koşulu (q, durum=devam) aynı anda gerekebildiği için `AND`
 * dizisine toplanır — tek `where.OR` alanı üst üste yazılmasın diye.
 */
import { Prisma } from '@/generated/prisma'

export function buildUygunsuzlukWhere(sp: URLSearchParams): Prisma.KaliteUygunsuzlukWhereInput {
  const and: Prisma.KaliteUygunsuzlukWhereInput[] = []

  const isEmriNo = sp.get('isEmriNo')?.trim()
  if (isEmriNo) and.push({ isEmriNo: { contains: isEmriNo, mode: 'insensitive' } })

  const mamulUrunKodu = sp.get('mamulUrunKodu')?.trim()
  if (mamulUrunKodu) and.push({ mamulUrunKodu: { contains: mamulUrunKodu, mode: 'insensitive' } })

  const musteriAdi = sp.get('musteriAdi')?.trim()
  if (musteriAdi) and.push({ musteriAdi: { contains: musteriAdi, mode: 'insensitive' } })

  const bolumId = sp.get('tespitEdenBolumId')
  if (bolumId) and.push({ tespitEdenBolumId: bolumId })

  const kategoriId = sp.get('kategoriId')
  if (kategoriId) and.push({ kategoriId })

  const durum = sp.get('durum')
  const ilerlemeOr: Prisma.KaliteUygunsuzlukWhereInput[] = [
    { kokNeden: { not: null } },
    { kacisKokNedeni: { not: null } },
    { duzelticiFaaliyet: { not: null } },
    { geciciAksiyon: { not: null } },
    { sorumluId: { not: null } },
    { onaylayanId: { not: null } },
    { termin: { not: null } },
  ]
  if (durum === 'acik') {
    and.push({ kapanisTarihi: null, AND: [{ NOT: { OR: ilerlemeOr } }] })
  } else if (durum === 'devam') {
    and.push({ kapanisTarihi: null, OR: ilerlemeOr })
  } else if (durum === 'kapali') {
    and.push({ kapanisTarihi: { not: null } })
  }

  const from = sp.get('from')
  const to = sp.get('to')
  if (from || to) {
    const tarih: Prisma.DateTimeFilter = {}
    if (from) tarih.gte = new Date(from)
    if (to) tarih.lte = new Date(to)
    and.push({ tarih })
  }

  const q = sp.get('q')?.trim()
  if (q) {
    const or: Prisma.KaliteUygunsuzlukWhereInput[] = [
      { isEmriNo: { contains: q, mode: 'insensitive' } },
      { mamulUrunKodu: { contains: q, mode: 'insensitive' } },
      { musteriAdi: { contains: q, mode: 'insensitive' } },
    ]
    const asNo = Number.parseInt(q, 10)
    if (Number.isInteger(asNo) && String(asNo) === q) or.push({ no: asNo })
    and.push({ OR: or })
  }

  return and.length > 0 ? { AND: and } : {}
}
