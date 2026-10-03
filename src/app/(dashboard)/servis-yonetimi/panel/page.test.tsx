import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import ServisPaneliPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

function oturum(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } },
    status: 'authenticated',
  } as unknown as ReturnType<typeof useSession>)
}

const ozet = (o: object) => ({
  kapasite: 10, atananPersonelSayisi: 5, bosKoltuk: 5, dolulukOrani: 50, aracSayisi: 1,
  durum: 'UYGUN', asimMiktari: 0, ...o,
})
const satir = (kod: string, ad: string, araclar: string[], o: object = {}) => ({
  guzergahId: `id-${kod}`, kod, ad, dilimKod: 'SABAH', dilimSayisi: 1, aracliDilimSayisi: araclar.length,
  araclar, ozet: ozet(o), dilimler: [],
})

const TOPLU = {
  tarih: '2026-10-03',
  guzergahlar: [
    satir('G1', 'İstanbul Hattı', ['34 ABC 123'], { kapasite: 16, atananPersonelSayisi: 15, bosKoltuk: 1, dolulukOrani: 93.75, durum: 'DOLMAK_UZERE' }),
    satir('G2', 'Şişli Hattı', ['34 SIS 001'], { kapasite: 10, atananPersonelSayisi: 12, bosKoltuk: -2, dolulukOrani: 120, durum: 'ASIM', asimMiktari: 2 }),
    satir('G3', 'Çayırova Hattı', [], { kapasite: 0, atananPersonelSayisi: 3, bosKoltuk: 0, dolulukOrani: null, durum: 'ARAC_YOK', aracSayisi: 0 }),
  ],
  dilimSatirlari: [],
  asimlar: [{ guzergahId: 'id-G2', kod: 'G2', ad: 'Şişli Hattı', dilimKod: 'SABAH', koltuk: 10, personel: 12, fazla: 2 }],
  toplam: {
    guzergahSayisi: 3, atanmisPersonel: 30, toplamKoltuk: 26, netBosKoltuk: -1,
    asimSayisi: 1, asimKisi: 2, aracsizGuzergahSayisi: 1, dolmakUzereSayisi: 1,
  },
}
const PANEL = {
  buAy: { yil: 2026, ay: 10, yeniServisKullanicisi: 4, servistenAyrilan: 1, servisDegistiren: 2, durakDegistiren: 1, aracDegisenServis: 0, soforDegisenServis: 1, vardiyaDegistiren: 0, toplam: 9 },
  veriKalite: { kontrolSayisi: 17, bulguluKontrol: 2, toplamBulgu: 7, hataliKontrol: 0, enCokBulgu: [{ kod: 'X', baslik: 'Araçsız güzergâh', adet: 5, hata: false }] },
}
const KPI = { durumKirilim: [{ durum: 'ACIK', adet: 6 }, { durum: 'AKSIYON_ALINDI', adet: 2 }] }

let fetchMock: ReturnType<typeof vi.fn>
function fetchKur(toplu: unknown = TOPLU) {
  fetchMock = vi.fn(async (url: string) => {
    const data = url.includes('kapasite-toplu') ? toplu : url.includes('/panel') ? PANEL : KPI
    return { ok: true, status: 200, json: async () => ({ ok: true, data }) }
  })
  vi.stubGlobal('fetch', fetchMock)
}

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => {
  vi.resetAllMocks()
  fetchKur()
})

const cagrilanUrller = () => fetchMock.mock.calls.map((c) => c[0] as string)

describe('Servis Paneli — yetki', () => {
  it('servis.view yoksa içerik ve veri isteği YOK', () => {
    oturum([])
    render(<ServisPaneliPage />)
    expect(screen.getByText(/yetkiniz yok/)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('🔴 export düğmeleri: yalnız servis.view → YOK', async () => {
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    await waitFor(() => expect(screen.getByText('Güzergâh bazında kapasite')).toBeTruthy())
    expect(screen.queryByText(/Kapasite Raporu \(Excel\)/)).toBeNull()
    expect(screen.queryByText(/Güzergâh Listesi \(PDF\)/)).toBeNull()
  })

  it('🔴 export düğmeleri: yalnız servis.export (view yok) → sayfa da yok', () => {
    oturum(['servis.export'])
    render(<ServisPaneliPage />)
    expect(screen.queryByText(/Kapasite Raporu/)).toBeNull()
  })

  it('view + export → iki düğme doğru adreslerle', async () => {
    oturum(['servis.view', 'servis.export'])
    render(<ServisPaneliPage />)
    const excel = await screen.findByText(/Kapasite Raporu \(Excel\)/)
    expect(excel.closest('a')?.getAttribute('href')).toBe('/api/servis-yonetimi/export/kapasite')
    expect(screen.getByText(/Güzergâh Listesi \(PDF\)/).closest('a')?.getAttribute('href')).toBe(
      '/api/servis-yonetimi/export/guzergah-listesi-pdf',
    )
  })

  it('şikâyet kartı ve /sikayet/kpi isteği yalnız servis.sikayet.view ile', async () => {
    oturum(['servis.view'])
    const { unmount } = render(<ServisPaneliPage />)
    await waitFor(() => expect(screen.getByText('Veri Kalitesi')).toBeTruthy())
    expect(screen.queryByText('Şikâyetler')).toBeNull()
    expect(cagrilanUrller().some((u) => u.includes('/sikayet/kpi'))).toBe(false)
    unmount()

    oturum(['servis.view', 'servis.sikayet.view'])
    render(<ServisPaneliPage />)
    await screen.findByText('Şikâyetler')
    await waitFor(() => expect(screen.getByText('açık').parentElement?.textContent).toContain('6'))
  })
})

describe('Servis Paneli — içerik', () => {
  it('başlık, bugünün tarihli alt başlığı, 5 KPI kartı', async () => {
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    expect(await screen.findByRole('heading', { name: 'Servis Paneli' })).toBeTruthy()
    expect(screen.getByText(/Bugünkü kapasite ve doluluk · /)).toBeTruthy()
    expect(screen.getByTestId('kpi-Güzergâh').textContent).toBe('3')
    expect(screen.getByTestId('kpi-Atanmış personel').textContent).toBe('30')
    expect(screen.getByTestId('kpi-Toplam koltuk').textContent).toBe('26')
    expect(screen.getByTestId('kpi-Boş koltuk').textContent).toBe('-1')
    expect(screen.getByTestId('kpi-Kapasite aşımı').textContent).toBe('1')
  })

  it('kırmızı aşım bandı güzergâh bağlantısı ve +fazla ile', async () => {
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    const bant = await screen.findByText(/1 güzergâh\/dilimde kapasite aşıldı/)
    const kutu = bant.closest('[role="alert"]') as HTMLElement
    expect(within(kutu).getByText(/G2 — Şişli Hattı/).closest('a')?.getAttribute('href')).toBe('/servis-yonetimi/guzergah/id-G2')
    expect(kutu.textContent).toContain('12 kişi / 10 koltuk (+2)')
  })

  it('aşım yoksa bant da yok', async () => {
    fetchKur({ ...TOPLU, asimlar: [], toplam: { ...TOPLU.toplam, asimSayisi: 0, asimKisi: 0 } })
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    await screen.findByText('Güzergâh bazında kapasite')
    expect(screen.queryByText(/kapasite aşıldı/)).toBeNull()
  })

  it('durum rozetleri: Dolmak üzere / Aşım +N / Araç yok; araç yokta koltuk ve boş "—"', async () => {
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    await screen.findByText('Güzergâh bazında kapasite')
    const satirlar = screen.getAllByRole('row')
    const g = (kod: string) => satirlar.find((r) => r.textContent?.includes(kod + ' —')) as HTMLElement
    expect(g('G1').textContent).toContain('Dolmak üzere')
    expect(g('G2').textContent).toContain('Aşım +2')
    expect(g('G3').textContent).toContain('Araç yok')
    const hucreler = within(g('G3')).getAllByRole('cell').map((c) => c.textContent)
    expect(hucreler[2]).toBe('—')
    expect(hucreler[4]).toBe('—')
    expect(hucreler[5]).toContain('—')
  })

  it('sağ kolon: Bu Ay Ne Değişti, Veri Kalitesi + Veri Kalite Merkezi düğmesi', async () => {
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    await screen.findByText('Bu Ay Ne Değişti?')
    await screen.findByText(/yeni servis kullanıcısı/)
    expect(screen.getByText('Ekim 2026')).toBeTruthy()
    expect(screen.getByText('Araçsız güzergâh:').parentElement?.textContent).toContain('5')
    expect(screen.getByRole('link', { name: 'Veri Kalite Merkezi' }).getAttribute('href')).toBe('/servis-yonetimi/veri-kalite')
  })

  it('boş durum: aktif güzergâh yoksa açıklama ve Servis Yönetimi bağlantısı', async () => {
    fetchKur({ ...TOPLU, guzergahlar: [], asimlar: [], toplam: { ...TOPLU.toplam, guzergahSayisi: 0 } })
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    expect(await screen.findByText('Henüz aktif güzergâh yok.')).toBeTruthy()
    expect(screen.queryByText('Güzergâh bazında kapasite')).toBeNull()
  })

  it('kapasite ucu hata verirse mesaj gösterilir (sessiz değil)', async () => {
    fetchMock = vi.fn(async (url: string) =>
      url.includes('kapasite-toplu')
        ? { ok: false, status: 403, json: async () => ({ error: 'Yetersiz yetki' }) }
        : { ok: true, status: 200, json: async () => ({ ok: true, data: PANEL }) },
    )
    vi.stubGlobal('fetch', fetchMock)
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    expect(await screen.findByText('Bu işlem için yetkiniz yok.')).toBeTruthy()
  })
})

describe('Servis Paneli — Türkçe arama ve sıralama', () => {
  it('"istanbul" ve "SISLI" aramaları Türkçe harflerle eşleşir', async () => {
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    const kutu = await screen.findByLabelText('Güzergâh ara')
    // Aşım bandında Şişli her zaman görünür; arama YALNIZ tablo satırlarını etkiler.
    const tablo = () => within(screen.getByRole('table'))
    fireEvent.change(kutu, { target: { value: 'istanbul' } })
    expect(tablo().getByText(/İstanbul Hattı/)).toBeTruthy()
    expect(tablo().queryByText(/Şişli Hattı/)).toBeNull()
    fireEvent.change(kutu, { target: { value: 'SISLI' } })
    expect(tablo().getByText(/Şişli Hattı/)).toBeTruthy()
    expect(tablo().queryByText(/İstanbul Hattı/)).toBeNull()
    fireEvent.change(kutu, { target: { value: 'yok böyle' } })
    expect(screen.getByText('Aramayla eşleşen güzergâh yok.')).toBeTruthy()
  })

  it('Doluluk başlığı: artan → azalan → sırasız; araç yok her zaman sonda', async () => {
    oturum(['servis.view'])
    render(<ServisPaneliPage />)
    await screen.findByText('Güzergâh bazında kapasite')
    const sira = () =>
      screen.getAllByRole('row').slice(1).map((r) => (r.textContent?.match(/G\d/) ?? [''])[0])
    const baslik = screen.getByRole('button', { name: /Doluluk/ })
    fireEvent.click(baslik)
    expect(sira()).toEqual(['G1', 'G2', 'G3'])
    fireEvent.click(baslik)
    expect(sira()).toEqual(['G2', 'G1', 'G3'])
    fireEvent.click(baslik)
    expect(sira()).toEqual(['G1', 'G2', 'G3'])
  })
})
