import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import TopluKapasitePage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

const oturum = (permissions: string[]) =>
  vi.mocked(useSession).mockReturnValue({ data: { user: { permissions } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)

const ozet = (o: object) => ({ kapasite: 10, atananPersonelSayisi: 5, bosKoltuk: 5, dolulukOrani: 50, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0, ...o })
const dilim = (kod: string, ad: string, dilimKod: string, araclar: string[], o: object) => ({
  guzergahId: `id-${kod}`, guzergahKod: kod, guzergahAd: ad, dilimId: `d-${kod}-${dilimKod}`, dilimKod, dilimAd: dilimKod === 'SABAH' ? 'Sabah Gidiş' : 'Akşam Dönüş', araclar, ozet: ozet(o),
})
const TOPLU = {
  tarih: '2026-03-05', guzergahlar: [], asimlar: [],
  dilimSatirlari: [
    dilim('G1', 'İstanbul Hattı', 'SABAH', ['34 ABC 123'], {}),
    dilim('G1', 'İstanbul Hattı', 'AKSAM', ['34 ABC 123'], { kapasite: 10, atananPersonelSayisi: 12, bosKoltuk: -2, dolulukOrani: 120, durum: 'ASIM', asimMiktari: 2 }),
    dilim('G2', 'Çayırova Hattı', 'SABAH', [], { kapasite: 0, atananPersonelSayisi: 3, bosKoltuk: -3, dolulukOrani: null, durum: 'ARAC_YOK', aracSayisi: 0 }),
  ],
  toplam: { guzergahSayisi: 2, atanmisPersonel: 20, toplamKoltuk: 20, netBosKoltuk: 3, asimSayisi: 1, asimKisi: 2, aracsizGuzergahSayisi: 1, dolmakUzereSayisi: 0 },
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: TOPLU }) }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('Toplu Kapasite', () => {
  it('servis.view yoksa veri isteği yok', () => {
    oturum([])
    render(<TopluKapasitePage />)
    expect(screen.getByText(/yetkiniz yok/)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('tarihle kapasite-toplu çağrılır; dilim satırları, aşım kırmızı, araç yok "—"', async () => {
    oturum(['servis.view'])
    render(<TopluKapasitePage />)
    await screen.findByText(/2 güzergâh · 1 aşım · 1 araçsız/)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/kapasite-toplu\?tarih=\d{4}-\d{2}-\d{2}$/)
    const satirlar = screen.getAllByRole('row').slice(1)
    expect(satirlar).toHaveLength(3)
    expect(satirlar[1].textContent).toContain('Aşım +2')
    const g2 = within(satirlar[2]).getAllByRole('cell').map((c) => c.textContent)
    expect(g2[3]).toBe('—')
    expect(g2[5]).toBe('—')
    expect(satirlar[2].textContent).toContain('Araç yok')
  })

  it('tarih değişince yeni tarihle istek atılır', async () => {
    oturum(['servis.view'])
    render(<TopluKapasitePage />)
    await screen.findByText(/2 güzergâh/)
    fireEvent.change(screen.getByLabelText('Hesap tarihi'), { target: { value: '2026-03-05' } })
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('tarih=2026-03-05'))).toBe(true))
  })

  it('Türkçe arama ("cayirova") ve "yalnız aşımlar" filtresi', async () => {
    oturum(['servis.view'])
    render(<TopluKapasitePage />)
    await screen.findByText(/2 güzergâh/)
    fireEvent.change(screen.getByLabelText('Ara'), { target: { value: 'CAYIROVA' } })
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Ara'), { target: { value: '' } })
    fireEvent.click(screen.getByLabelText('Yalnız kapasite aşımları'))
    const r = screen.getAllByRole('row').slice(1)
    expect(r).toHaveLength(1)
    expect(r[0].textContent).toContain('AKSAM')
  })

  it('🔴 Excel düğmesi yalnız view+export; tarih parametresiyle', async () => {
    oturum(['servis.view'])
    const { unmount } = render(<TopluKapasitePage />)
    await screen.findByText(/2 güzergâh/)
    expect(screen.queryByText(/Kapasite Raporu \(Excel\)/)).toBeNull()
    unmount()
    oturum(['servis.view', 'servis.export'])
    render(<TopluKapasitePage />)
    const b = await screen.findByText(/Kapasite Raporu \(Excel\)/)
    expect(b.closest('a')?.getAttribute('href')).toMatch(/^\/api\/servis-yonetimi\/export\/kapasite\?tarih=\d{4}-\d{2}-\d{2}$/)
  })

  it('hata mesajı görünür', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false, message: 'Hesap tarihi geçersiz.' }) })
    oturum(['servis.view'])
    render(<TopluKapasitePage />)
    expect(await screen.findByText('Hesap tarihi geçersiz.')).toBeTruthy()
  })
})
