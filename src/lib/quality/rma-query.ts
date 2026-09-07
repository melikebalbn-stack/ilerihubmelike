/**
 * RMA/SMA liste filtresi — TEK KAYNAK sorgu kurucu (KAL-KYT-16).
 *
 * Liste ucu (GET /api/quality/rma) ve Excel export ucu
 * (GET /api/quality/rma/export) AYNI filtreyi kullansın diye buraya çıkarıldı;
 * iki uç ıraksamasın. Filtre: tip, musteriId, durum(acik|kapali),
 * from/to (irsaliyeTarihi), q (no | ürün kodu | müşteri adı),
 * sadeceBana (yalnız oturumun sorumlu olduğu kayıtlar).
 */
import { RmaTip, RmaDurum, Prisma } from '@/generated/prisma'

/**
 * @param benimPersonnelId Oturum sahibinin Personnel id'si (User.personnelId).
 *   `sadeceBana=1` filtresi bunu kullanır; çağıran uç DB'den çözer.
 */
export function buildRmaWhere(
  sp: URLSearchParams,
  benimPersonnelId: string | null = null,
): Prisma.RmaKayitWhereInput {
  const where: Prisma.RmaKayitWhereInput = {}

  const tip = sp.get('tip')
  if (tip === 'RMA' || tip === 'SMA') where.tip = tip as RmaTip

  const musteriId = sp.get('musteriId')
  if (musteriId) where.musteriId = musteriId

  // Durum artık kolon (RmaDurum); kapanisTarihi'nden TÜRETİLMİYOR.
  const durum = sp.get('durum')
  if (durum === 'acik') where.durum = RmaDurum.ACIK
  else if (durum === 'kapali') where.durum = RmaDurum.KAPALI

  // "Bana atananlar": personel bağlantısı olmayan kullanıcıda FAIL-CLOSED —
  // '' hiçbir cuid ile eşleşmez, sonuç boş döner (tüm kayıtlar sızmaz).
  if (sp.get('sadeceBana') === '1') where.sorumluId = benimPersonnelId ?? ''

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
