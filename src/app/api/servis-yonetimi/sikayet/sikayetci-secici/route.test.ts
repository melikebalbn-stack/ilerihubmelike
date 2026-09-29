import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  sikayetciAra: vi.fn(),
}))

// 🔴 require-permission MOCK'LANMIYOR — GERÇEK guard koşuyor. Bkz.
// ../route.test.ts'teki aynı gerekçe: guard mock'lansaydı yanlış anahtar
// yazılsa bile test geçerdi, sahte güvence olurdu.
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: mocks.getUserPermissions }))
vi.mock('@/lib/servis-yonetimi/sikayetci-secici', () => ({ sikayetciAra: mocks.sikayetciAra }))

import { GET } from './route'

function oturumKur(izinler: string[] | null) {
  if (izinler === null) {
    mocks.getServerSession.mockResolvedValue(null)
    return
  }
  mocks.getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserPermissions.mockResolvedValue(new Set(izinler))
}

const VIEW = 'servis.sikayet.view'
const MANAGE = 'servis.sikayet.manage'

const istek = (arama?: string) =>
  new NextRequest(
    `http://localhost/api/servis-yonetimi/sikayet/sikayetci-secici${arama !== undefined ? `?arama=${encodeURIComponent(arama)}` : ''}`,
  )

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.sikayetciAra.mockResolvedValue([{ id: 'p1', adSoyad: 'Ayşe Yılmaz', sicilNo: '111', bolum: 'Montaj' }])
})

describe('GET sikayetci-secici — yetki', () => {
  it('POZİTİF: servis.sikayet.manage izniyle 200 ve sonuç döner', async () => {
    oturumKur([MANAGE])
    const res = await GET(istek('ay'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([{ id: 'p1', adSoyad: 'Ayşe Yılmaz', sicilNo: '111', bolum: 'Montaj' }])
  })

  it('NEGATİF: servis.sikayet.view (yalnız görüntüleme) TEK BAŞINA YETMEZ, 403', async () => {
    oturumKur([VIEW])
    const res = await GET(istek('ay'))
    expect(res.status).toBe(403)
    expect(mocks.sikayetciAra).not.toHaveBeenCalled()
  })

  it('NEGATİF: hiç izni olmayan kullanıcı 403 alır', async () => {
    oturumKur([])
    const res = await GET(istek('ay'))
    expect(res.status).toBe(403)
  })

  it('NEGATİF: oturumsuz istek 401/403 alır (asla 200 değil)', async () => {
    oturumKur(null)
    const res = await GET(istek('ay'))
    expect(res.status).not.toBe(200)
  })

  it('yanıt gövdesinde yasaklı alan YOK (assertion ile)', async () => {
    mocks.sikayetciAra.mockResolvedValue([
      { id: 'p1', adSoyad: 'Ayşe Yılmaz', sicilNo: '111', bolum: 'Montaj' },
    ])
    oturumKur([MANAGE])
    const res = await GET(istek('ay'))
    const body = await res.json()
    const govdeMetni = JSON.stringify(body)
    for (const yasakli of ['serviceRoute', 'serviceStop', 'telefon', 'ikametAdresi', 'mailAdresi', 'azureAdEmail']) {
      expect(govdeMetni.includes(yasakli)).toBe(false)
    }
  })
})

// ----------------------------------------------------------------------------
// 🔴 BOZMA TESTİ — guard'ı kaldırınca bu test kırılır (kanıt, aşağıda çalıştırılıp
// sonucu rapora yazılacak; test dosyasının KENDİSİNDE guard'ı kaldırma YOK,
// yalnız yukarıdaki 403 testleri guard'ın var olduğunu sabitliyor).
// ----------------------------------------------------------------------------
