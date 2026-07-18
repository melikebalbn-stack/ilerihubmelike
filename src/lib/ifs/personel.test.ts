/**
 * IFS personel istemcisi — SetBlocked bound action'ının If-Match/ETag sözleşmesi.
 * Saf birim testi: global fetch mock'lu, DB yok, ağ yok.
 *
 * Kanıtlanan kök sebep: bound action entity durumunu değiştirir → If-Match
 * zorunlu. Başlıksız çağrı IFS'te "A precondition is missing in the request."
 * ile reddediliyordu.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/ifs/config', () => ({
  getIfsConfig: () => ({
    baseUrl: 'https://ifs.example.com/int/ifsapplications/projection/v1/ShopFloorService.svc',
    tokenUrl: 'https://ifs.example.com/token',
    clientId: 'x',
    clientSecret: 'y',
    contract: 'ILER2',
    company: 'ILERI2',
  }),
}))
vi.mock('@/lib/ifs/token', () => ({ getIfsAccessToken: async () => 'sahte-token' }))

import { blockShopFloorEmployeeSite, IfsPersonelError } from '@/lib/ifs/personel'

const ETAG = 'W/"Vy8iQUFBZWMvQUFzQUFCVFRiQUFCOjIwMjYwNzE4MTcxOTM5Ig=="'

type Cagri = { url: string; init: RequestInit }
let cagrilar: Cagri[] = []

/** GET → verilen etag; POST → verilen sonuç. */
function fetchKur(opts: { etag?: string | null; govdeEtag?: string; postStatus?: number; postBody?: unknown }) {
  const { etag = ETAG, govdeEtag, postStatus = 200, postBody = {} } = opts
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      cagrilar.push({ url, init })
      const h = new Headers()
      if (init.method === 'GET' || !init.method) {
        if (etag) h.set('etag', etag)
        return new Response(JSON.stringify({ EmployeeId: 'E1', Objstate: 'Active', ...(govdeEtag ? { '@odata.etag': govdeEtag } : {}) }), { status: 200, headers: h })
      }
      return new Response(JSON.stringify(postBody), { status: postStatus, headers: h })
    }),
  )
}

beforeEach(() => {
  cagrilar = []
  vi.unstubAllGlobals()
})

describe('blockShopFloorEmployeeSite — If-Match sözleşmesi', () => {
  it('önce GET ile ETag okur, sonra POST’u If-Match ile atar', async () => {
    fetchKur({})
    await blockShopFloorEmployeeSite('TEST-005')

    expect(cagrilar).toHaveLength(2)
    const [get, post] = cagrilar

    // 1) ETag okuması: entity anahtarına GET, action segmenti YOK
    expect(get.url).toContain("ShopFloorEmployeeSites(Company='ILERI2',Contract='ILER2',EmployeeId='TEST-005')")
    expect(get.url).not.toContain('SetBlocked')

    // 2) Bound action: If-Match ile ve GET’ten okunan ETag’in AYNISI
    expect(post.init.method).toBe('POST')
    expect(post.url).toContain('/IfsApp.ShopFloorEmployeesHandling.ShopFloorEmployeeSite_SetBlocked')
    expect((post.init.headers as Record<string, string>)['If-Match']).toBe(ETAG)
  })

  it('If-Match: * ASLA gönderilmez (eşzamanlılık kontrolü atlanmaz)', async () => {
    fetchKur({})
    await blockShopFloorEmployeeSite('TEST-005')
    const post = cagrilar[1]
    expect((post.init.headers as Record<string, string>)['If-Match']).not.toBe('*')
  })

  it('header yoksa gövdedeki @odata.etag kullanılır', async () => {
    fetchKur({ etag: null, govdeEtag: 'W/"govdeden"' })
    await blockShopFloorEmployeeSite('TEST-005')
    expect((cagrilar[1].init.headers as Record<string, string>)['If-Match']).toBe('W/"govdeden"')
  })

  it('ETag hiç okunamazsa POST ATILMAZ, hata fırlatır', async () => {
    fetchKur({ etag: null })
    await expect(blockShopFloorEmployeeSite('TEST-005')).rejects.toThrow(/ETag okunamadı/)
    expect(cagrilar).toHaveLength(1) // yalnız GET — yazma denenmedi
  })

  it('412 (ETag bayatlamış) → IfsPersonelError, durum koda sızar', async () => {
    fetchKur({
      postStatus: 412,
      postBody: { error: { message: 'Precondition Failed', details: [{ message: 'Kayıt başkası tarafından değiştirildi' }] } },
    })
    await expect(blockShopFloorEmployeeSite('TEST-005')).rejects.toMatchObject({
      name: 'IfsPersonelError',
      status: 412,
      detay: 'Kayıt başkası tarafından değiştirildi',
    })
  })

  it('412 hatası IfsPersonelError örneğidir (senkron hatalilar[]’a düşürebilsin)', async () => {
    fetchKur({ postStatus: 412, postBody: { error: { message: 'Precondition Failed' } } })
    await expect(blockShopFloorEmployeeSite('TEST-005')).rejects.toBeInstanceOf(IfsPersonelError)
  })
})
