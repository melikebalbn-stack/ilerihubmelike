import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import GuzergahDetayPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

// C7-11 — Hook SIRASI regresyonu: "Rendered more hooks than during the previous render".
// Sayfa, oturum izinleri gelmeden önce (canView=false → erken return) ve geldikten sonra AYNI sayıda hook çağırmalı.
// Üretimde F5: oturum önce boş gelir, sonra izinlerle dolar → hook sayısı değişirse hata sınırına düşer.
const GUZERGAH = {
  id: 'g1', kod: 'ARAPCESME', ad: 'Arapçeşme', aciklama: null, bolge: null, aktif: true,
  yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, gecerlilikBaslangici: null, gecerlilikBitisi: null,
}
const SABAH = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi', yon: 'GIDIS', aktif: true }
const ozetSatiri = {
  guzergahId: 'g1', kod: 'ARAPCESME', ad: 'Arapçeşme', dilimKod: 'SABAH_GIDIŞ', dilimSayisi: 1, tekilPersonel: 7, araclar: ['34LAC828'], dilimler: [],
  ozet: { kapasite: 15, atananPersonelSayisi: 1, bosKoltuk: 14, dolulukOrani: 6.67, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 },
}

const OTURUM_IZINLI = ['servis.view', 'servis.tanim.manage', 'servis.edit', 'servis.passive', 'servis.restore']
let hataKaydi: ReturnType<typeof vi.spyOn>
let fetchMock: ReturnType<typeof vi.fn>

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })
function oturum(permissions: string[], status: 'loading' | 'authenticated' = 'authenticated') {
  vi.mocked(useSession).mockReturnValue({ data: status === 'loading' ? null : { user: { permissions } }, status } as unknown as ReturnType<typeof useSession>)
}
const hookHatasi = () => hataKaydi.mock.calls.some((c: unknown[]) => /Rendered (more|fewer) hooks/i.test(String(c[0]) + String(c[1] ?? '')))

beforeEach(() => {
  hataKaydi = vi.spyOn(console, 'error').mockImplementation(() => {})
  window.history.pushState({}, '', '/servis-yonetimi/guzergah/g1')
})
afterEach(() => {
  hataKaydi.mockRestore()
  vi.unstubAllGlobals()
})

describe('C7-11 — GuzergahDetayPage hook sırası', () => {
  it('🔴 oturum yükleniyor (izin yok) → izinli oturum: hook sayısı değişmez, sayfa çizilir', async () => {
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      const veri = u.endsWith('/guzergah/g1') ? GUZERGAH : u.includes('sefer-dilimi') ? [SABAH] : u.includes('kapasite-toplu') ? { guzergahlar: [ozetSatiri] } : []
      return json(200, { ok: true, data: veri })
    })
    vi.stubGlobal('fetch', fetchMock)
    oturum([], 'loading')
    const { rerender } = render(<GuzergahDetayPage />)
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeTruthy() // izin gelmeden erken return
    oturum(OTURUM_IZINLI)
    rerender(<GuzergahDetayPage />)
    expect(await screen.findByRole('tab', { name: 'Personel Atamaları' })).toBeTruthy()
    expect(hookHatasi()).toBe(false)
  })

  it('🔴 izinli oturum → izin kalktı (oturum bitti) → tekrar izinli: hook sayısı sabit', async () => {
    fetchMock = vi.fn(async (url: string) => json(200, { ok: true, data: String(url).endsWith('/guzergah/g1') ? GUZERGAH : String(url).includes('sefer-dilimi') ? [SABAH] : String(url).includes('kapasite-toplu') ? { guzergahlar: [] } : [] }))
    vi.stubGlobal('fetch', fetchMock)
    oturum(OTURUM_IZINLI)
    const { rerender } = render(<GuzergahDetayPage />)
    await screen.findByRole('tab', { name: 'Duraklar' })
    oturum([])
    rerender(<GuzergahDetayPage />)
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeTruthy()
    oturum(OTURUM_IZINLI)
    rerender(<GuzergahDetayPage />)
    expect(await screen.findByRole('tab', { name: 'Duraklar' })).toBeTruthy()
    expect(hookHatasi()).toBe(false)
  })

  it('🔴 fetch beklemede ("Yükleniyor") → veri çözülür → kartlar ve sekmeler çizilir', async () => {
    let coz: () => void = () => {}
    const bekle = new Promise<void>((r) => { coz = r })
    fetchMock = vi.fn(async (url: string) => {
      await bekle
      const u = String(url)
      return json(200, { ok: true, data: u.endsWith('/guzergah/g1') ? GUZERGAH : u.includes('sefer-dilimi') ? [SABAH] : u.includes('kapasite-toplu') ? { guzergahlar: [ozetSatiri] } : [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    oturum(OTURUM_IZINLI)
    render(<GuzergahDetayPage />)
    expect(screen.getByText('Yükleniyor...')).toBeTruthy()
    await act(async () => { coz(); await bekle })
    expect(await screen.findByTestId('guzergah-kart-Koltuk')).toBeTruthy()
    expect(screen.getByTestId('guzergah-kart-Koltuk').textContent).toBe('15')
    expect(screen.getByTestId('guzergah-kart-Boş koltuk').textContent).toBe('14')
    expect(hookHatasi()).toBe(false)
  })

  it('🔴 güzergâh bulunamadı (404) → hata durumu; ardından izin değişimi bile hook hatası vermez', async () => {
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.endsWith('/guzergah/g1')) return json(404, { ok: false, message: 'Güzergâh bulunamadı.' })
      return json(200, { ok: true, data: u.includes('sefer-dilimi') ? [SABAH] : [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    oturum([], 'loading')
    const { rerender } = render(<GuzergahDetayPage />)
    oturum(OTURUM_IZINLI)
    rerender(<GuzergahDetayPage />)
    expect(await screen.findByText('Güzergâh bulunamadı.')).toBeTruthy()
    expect(screen.queryByTestId('guzergah-kart-Koltuk')).toBeNull()
    expect(hookHatasi()).toBe(false)
  })
})
