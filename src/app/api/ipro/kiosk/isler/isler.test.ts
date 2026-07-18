/**
 * Kiosk isler endpoint testi (integration — gerçek dev DB, IFS mock'lu).
 * shop-order-operations mock'lu → server-only yüklenmez, gerçek IFS'e gidilmez.
 * requireKiosk mock'lu (KIOSK-TEST → MM63, work center BOŞ → filtresiz beklenir).
 */
import { describe, it, expect, vi, afterAll } from 'vitest'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo' // WC=705 (dolu)
const KH31_ID = 'cmrl3of4m0003ybpetrdmov87' // WC boş
const DIS_TEZGAH = 'cmrl3of9q001nybpecfj0rhf2'

vi.mock('@/lib/ipro/require-kiosk', () => ({
  requireKiosk: vi.fn(async () => ({
    kiosk: {
      id: 'test-kiosk', kod: 'KIOSK-TEST', ad: 'Test', aktif: true, userId: 'x',
      tezgahlar: [
        { tezgah: { id: MM63_ID, kod: 'MM63', ad: 'MM63' } },
        { tezgah: { id: KH31_ID, kod: 'KH31', ad: 'KH31' } },
      ],
    },
    error: null,
  })),
}))

const getShopOrderOperationsMock = vi.fn(async (_args: { workCenter?: string }) => [
  { id: '109-20', isMerkezi: '', isEmriNo: '109', operasyon: 'Test op', operasyonNo: 20, stokKodu: 'P1', stokAdi: 'Parça', teslimTarihi: '', miktar: 10, kalanMiktar: 9, uretilenMiktar: 1, hurdaMiktar: 0, durum: 'ISLENEBILIR' as const },
])
vi.mock('@/lib/ifs/shop-order-operations', () => ({
  getShopOrderOperations: (args: { workCenter?: string }) => getShopOrderOperationsMock(args),
}))

import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/ipro/kiosk/isler/route'

function req(params: Record<string, string>): any {
  const u = new URL('http://x/api')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return { nextUrl: u }
}

afterAll(async () => { await prisma.$disconnect() })

describe('kiosk isler', () => {
  // WC filtresi YOK (IFS'te tezgah↔planlama-WC eşlemesi bulunamadı — bkz. route yorumu).
  // Tezgahın ifsWorkCenterNo'su dolu (MM63=705) veya boş (KH31) olsun, HER ZAMAN filtresiz.
  it('MM63 (ifsWorkCenterNo=705 dolu) → yine de filtresiz çağrı', async () => {
    getShopOrderOperationsMock.mockClear()
    const res = await GET(req({ tezgahId: MM63_ID }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(Array.isArray(d.isler)).toBe(true)
    expect(d.tumAcikIsler).toBe(true)
    expect(getShopOrderOperationsMock).toHaveBeenCalledWith({})
  })

  it('KH31 (ifsWorkCenterNo boş) → filtresiz çağrı', async () => {
    getShopOrderOperationsMock.mockClear()
    const res = await GET(req({ tezgahId: KH31_ID }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.tumAcikIsler).toBe(true)
    expect(getShopOrderOperationsMock).toHaveBeenCalledWith({})
  })

  it('tezgahId yok → 400', async () => {
    const res = await GET(req({}))
    expect(res.status).toBe(400)
  })

  it('bağlı OLMAYAN tezgah → 403', async () => {
    const res = await GET(req({ tezgahId: DIS_TEZGAH }))
    expect(res.status).toBe(403)
  })

  it('IFS hata → 503 (operatör diliyle)', async () => {
    getShopOrderOperationsMock.mockRejectedValueOnce(new Error('IFS down'))
    const res = await GET(req({ tezgahId: MM63_ID }))
    expect(res.status).toBe(503)
  })
})
