/**
 * Kiosk isler endpoint testi (integration — gerçek dev DB, IFS mock'lu).
 * shop-order-operations + work-center-departments mock'lu → server-only yüklenmez,
 * gerçek IFS'e gidilmez. requireKiosk mock'lu.
 *
 * Yeni davranış: iş listesi tezgahın BÖLÜMÜNE süzülür (kod==ResourceId → WC →
 * DepartmentNo; açık işler isEmriWcDepartmanKoku ile o bölüme filtrelenir).
 * Bölüm çözülemezse filtresiz + filtreliMi=false.
 */
import { describe, it, expect, vi, afterAll } from 'vitest'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo' // kod MM63 → kaynak WC=705 → bölüm WMM
const KH31_ID = 'cmrl3of4m0003ybpetrdmov87' // kod KH31 → kaynak eşleşmesi YOK → filtresiz
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

// İki açık iş: WMM01 (bölüm WMM'e ait) + WPH01 (başka bölüm). Süzme WMM seçmeli.
const getShopOrderOperationsMock = vi.fn(async (_args: { workCenter?: string }) => [
  { id: '109-20', isMerkezi: 'WMM01', isEmriNo: '109', operasyon: 'Montaj', operasyonNo: 20, stokKodu: 'P1', stokAdi: 'Parça', teslimTarihi: '', miktar: 10, kalanMiktar: 9, uretilenMiktar: 1, hurdaMiktar: 0, durum: 'ISLENEBILIR' as const },
  { id: '200-10', isMerkezi: 'WPH01', isEmriNo: '200', operasyon: 'Pres', operasyonNo: 10, stokKodu: 'P2', stokAdi: 'Parça2', teslimTarihi: '', miktar: 5, kalanMiktar: 5, uretilenMiktar: 0, hurdaMiktar: 0, durum: 'ISLENEBILIR' as const },
])
vi.mock('@/lib/ifs/shop-order-operations', () => ({
  getShopOrderOperations: (args: { workCenter?: string }) => getShopOrderOperationsMock(args),
}))

// Metadata: MM63 kaynağı → WC 705 → bölüm WMM. KH31 için kaynak YOK (filtresiz düşer).
vi.mock('@/lib/ifs/work-center-departments', () => ({
  getWorkCenterResources: vi.fn(async () => [
    { resourceId: 'MM63', description: '', workCenterNo: '705' },
  ]),
  getWorkCenters: vi.fn(async () => [
    { workCenterNo: '705', description: 'PSA MONTAJ', departmentNo: 'WMM' },
    { workCenterNo: 'WMM01', description: 'MONTAJ HATTI', departmentNo: '' },
  ]),
  getWorkCenterDepartments: vi.fn(async () => [{ kod: 'WMM', ad: 'MEKANIK MONTAJ' }]),
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
  it('MM63 → bölüm WMM süzülür (yalnız WMM işleri, filtreliMi=true)', async () => {
    getShopOrderOperationsMock.mockClear()
    const res = await GET(req({ tezgahId: MM63_ID }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.filtreliMi).toBe(true)
    expect(d.departmanKod).toBe('WMM')
    expect(d.departmanAd).toBe('MEKANIK MONTAJ')
    expect(d.isler.map((i: { id: string }) => i.id)).toEqual(['109-20']) // WPH01 elendi
  })

  it('KH31 (kaynak eşleşmesi yok) → filtresiz tüm işler (filtreliMi=false)', async () => {
    getShopOrderOperationsMock.mockClear()
    const res = await GET(req({ tezgahId: KH31_ID }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.filtreliMi).toBe(false)
    expect(d.isler).toHaveLength(2) // her ikisi de döner
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
