import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// A3 — tarih/neden düzenleme PATCH uçları: araç varsayılan, şoför varsayılan,
// sorumlu, personel ataması. Her uç için: yetki anahtarı (API katmanı),
// 401/403 → servis HİÇ çağrılmaz, gövde + userId servise iletilir, servis
// hatası 400 + Türkçe mesaj.
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  guncelleServisGuzergahAracVarsayilan: vi.fn(),
  guncelleServisGuzergahSoforVarsayilan: vi.fn(),
  guncelleServisSorumlusu: vi.fn(),
  guncelleServisPersonelAtama: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  guncelleServisGuzergahAracVarsayilan: mocks.guncelleServisGuzergahAracVarsayilan,
  guncelleServisGuzergahSoforVarsayilan: mocks.guncelleServisGuzergahSoforVarsayilan,
  guncelleServisSorumlusu: mocks.guncelleServisSorumlusu,
  guncelleServisPersonelAtama: mocks.guncelleServisPersonelAtama,
}))

import { PATCH as aracPatch } from './guzergah-arac-varsayilan/[id]/route'
import { PATCH as soforPatch } from './guzergah-sofor-varsayilan/[id]/route'
import { PATCH as sorumluPatch } from './guzergah-sorumlu/[id]/route'
import { PATCH as atamaPatch } from './guzergah-personel-atama/[id]/route'

type Uc = {
  ad: string
  patch: typeof aracPatch
  izin: string
  servis: ReturnType<typeof vi.fn>
  govde: Record<string, unknown>
}

const UCLAR: Uc[] = [
  { ad: 'araç varsayılan', patch: aracPatch, izin: 'servis.tanim.manage', servis: mocks.guncelleServisGuzergahAracVarsayilan, govde: { baslangicTarihi: '2026-02-01', bitisTarihi: '2026-12-31', neden: 'düzeltme' } },
  { ad: 'şoför varsayılan', patch: soforPatch, izin: 'servis.tanim.manage', servis: mocks.guncelleServisGuzergahSoforVarsayilan, govde: { baslangicTarihi: '2026-02-01', bitisTarihi: null } },
  { ad: 'sorumlu', patch: sorumluPatch, izin: 'servis.sorumlu.manage', servis: mocks.guncelleServisSorumlusu, govde: { baslangicTarihi: '2026-02-01', aciklama: 'not' } },
  { ad: 'personel ataması', patch: atamaPatch, izin: 'servis.edit', servis: mocks.guncelleServisPersonelAtama, govde: { bitisTarihi: '2026-09-30' } },
]

const context = { params: Promise.resolve({ id: 'k1' }) }
const istek = (govde: unknown) =>
  new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify(govde) })

beforeEach(() => vi.clearAllMocks())

describe.each(UCLAR)('PATCH — $ad', ({ patch, izin, servis, govde }) => {
  it(`yetki anahtarı ${izin} istenir (fonksiyonun ilk ifadesi)`, async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
    servis.mockResolvedValue({ id: 'k1' })
    await patch(istek(govde), context)
    expect(mocks.requirePermission).toHaveBeenCalledWith(izin)
  })

  it('🔴 yetkisiz (403): servis HİÇ çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue({
      error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }), userId: null,
    })
    const res = await patch(istek(govde), context)
    expect(res.status).toBe(403)
    expect(servis).not.toHaveBeenCalled()
  })

  it('🔴 oturumsuz (401): servis HİÇ çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue({
      error: NextResponse.json({ error: 'Yetkisiz: oturum bulunamadı' }, { status: 401 }), userId: null,
    })
    const res = await patch(istek(govde), context)
    expect(res.status).toBe(401)
    expect(servis).not.toHaveBeenCalled()
  })

  it('gövde (başlangıç/bitiş dahil) ve kullanıcı servise AYNEN iletilir', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-9' })
    servis.mockResolvedValue({ id: 'k1' })
    const res = await patch(istek(govde), context)
    expect(res.status).toBe(200)
    expect(servis).toHaveBeenCalledWith('k1', govde, 'user-9')
  })

  it('servis hatası (ör. tarih kuralı) 400 ve Türkçe mesajla döner', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
    servis.mockRejectedValue(new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.'))
    const res = await patch(istek(govde), context)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('Bitiş tarihi başlangıç tarihinden önce olamaz.')
  })
})
