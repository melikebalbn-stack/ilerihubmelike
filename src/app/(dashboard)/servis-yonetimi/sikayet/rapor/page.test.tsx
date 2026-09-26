import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import SikayetRaporPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
// recharts jsdom'da genişlik 0 gördüğü için grafiği çizmez; sayılar zaten
// metin listesinde de var (grafik okunamazsa diye). Testler metne bakıyor.
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }
})

function mockSession(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } }, status: 'authenticated',
  } as ReturnType<typeof useSession>)
}

const KPI = {
  toplamSikayet: 3,
  reddedilenSayisi: 1,
  durumKirilim: [
    { durum: 'ACIK', adet: 2 },
    { durum: 'KAPANDI', adet: 1 },
    { durum: 'REDDEDILDI', adet: 1 },
  ],
  kategoriKirilim: [{ kategori: 'GEC_GELME', adet: 2 }, { kategori: 'TEMIZLIK', adet: 1 }],
  durakKirilim: [{ durakId: 'd1', adet: 2 }, { durakId: null, adet: 1 }],
  ortalamaKapanisGunu: 4,
  kapananKayitSayisi: 1,
  yenidenAcilanSayisi: 1,
}

function fetchMockKur(kpi: unknown = KPI, kpiYaniti?: { ok: boolean; body: unknown }) {
  const m = vi.fn(async (url: string) => {
    if (url.startsWith('/api/servis-yonetimi/sikayet/kpi')) {
      if (kpiYaniti) return { ok: kpiYaniti.ok, json: async () => kpiYaniti.body }
      return { ok: true, json: async () => ({ ok: true, data: kpi }) }
    }
    if (url.startsWith('/api/servis-yonetimi/durak')) {
      return { ok: true, json: async () => ({ ok: true, data: [{ id: 'd1', kod: 'D1', ad: 'Durak 1' }] }) }
    }
    return { ok: true, json: async () => ({ ok: true, data: [{ id: 'f1', ad: 'Firma A' }] }) }
  })
  global.fetch = m as unknown as typeof fetch
  return m
}

beforeEach(() => { vi.mocked(useSession).mockReset() })

describe('rapor ekranı — yetki', () => {
  it('servis.sikayet.view VARKEN rapor render ediliyor', async () => {
    mockSession(['servis.sikayet.view'])
    fetchMockKur()
    render(<SikayetRaporPage />)
    await waitFor(() => expect(screen.getByText('Toplam şikâyet')).toBeInTheDocument())
  })

  it('🔴 izin YOKKEN rapor yok ama SAYFA render ediliyor', async () => {
    mockSession(['servis.view'])
    const m = fetchMockKur()
    render(<SikayetRaporPage />)

    expect(screen.getByText('Servis Firma Performansı')).toBeInTheDocument()
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
    expect(screen.queryByText('Toplam şikâyet')).not.toBeInTheDocument()
    expect(m.mock.calls.filter(c => (c[0] as string).includes('/kpi'))).toHaveLength(0)
  })
})

describe('KPI kartları', () => {
  beforeEach(() => mockSession(['servis.sikayet.view']))

  it('🔴 ortalama kapanış kartında PAYDA görünüyor', async () => {
    fetchMockKur()
    render(<SikayetRaporPage />)
    await waitFor(() => expect(screen.getByText('4 gün')).toBeInTheDocument())
    expect(screen.getByText('1 kapanan kayıt üzerinden')).toBeInTheDocument()
  })

  it('kapanan kayıt yoksa ortalama "—" ve payda 0 yazıyor', async () => {
    fetchMockKur({ ...KPI, ortalamaKapanisGunu: null, kapananKayitSayisi: 0 })
    render(<SikayetRaporPage />)
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument())
    expect(screen.getByText('0 kapanan kayıt üzerinden')).toBeInTheDocument()
  })

  it('🔴 reddedilen AYRI kartta ve toplamın içinde değil', async () => {
    fetchMockKur()
    render(<SikayetRaporPage />)
    await waitFor(() => expect(screen.getByText('Reddedilen')).toBeInTheDocument())

    expect(screen.getByText('Toplama dahil değil')).toBeInTheDocument()
    expect(screen.getByText('Reddedilenler hariç')).toBeInTheDocument()
    // Neden ayrı durduğu ekranda yazıyor
    expect(screen.getByText('Reddedilen şikâyetler firma performansına sayılmaz.')).toBeInTheDocument()
  })

  it('açık sayısı durum kırılımından türetiliyor', async () => {
    fetchMockKur()
    render(<SikayetRaporPage />)

    // "Açık" hem KPI kartı başlığı hem durum kırılımı etiketi — ikisi de
    // olmalı, o yüzden getAllByText.
    await waitFor(() => expect(screen.getAllByText('Açık').length).toBeGreaterThan(0))
    // Kart değeri 2 (durumKirilim'deki ACIK adedi)
    const kart = screen.getAllByText('Açık').map(e => e.parentElement?.textContent ?? '')
    expect(kart.some(t => t.includes('2'))).toBe(true)
  })
})

describe('kırılımlar', () => {
  beforeEach(() => mockSession(['servis.sikayet.view']))

  it('🔴 DURAK kırılımı render ediliyor, durak adı çözülüyor', async () => {
    fetchMockKur()
    render(<SikayetRaporPage />)
    await waitFor(() => expect(screen.getByText('Durak kırılımı')).toBeInTheDocument())
    expect(screen.getByText('D1 — Durak 1')).toBeInTheDocument()
    expect(screen.getByText('Durak belirtilmemiş')).toBeInTheDocument()
  })

  it('durum ve kategori kırılımları Türkçe etiketle', async () => {
    fetchMockKur()
    render(<SikayetRaporPage />)
    await waitFor(() => expect(screen.getByText('Durum kırılımı')).toBeInTheDocument())
    expect(screen.getByText('Kategori kırılımı')).toBeInTheDocument()
    expect(screen.getByText('Geç gelme')).toBeInTheDocument()
    expect(screen.getByText('Temizlik')).toBeInTheDocument()
    // Ham enum adı ekrana sızmıyor
    expect(screen.queryByText('GEC_GELME')).not.toBeInTheDocument()
    expect(screen.queryByText('REDDEDILDI')).not.toBeInTheDocument()
    expect(screen.getAllByText('Reddedildi').length).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------------------
// 🔴 Ders 79 — ekranda yüzde/oran YOK
// ----------------------------------------------------------------------------
describe('yüzde/oran ekranda yok (Ders 79)', () => {
  it('🔴 render edilen metinde % / yüzde / oran GEÇMİYOR — desen taraması', async () => {
    mockSession(['servis.sikayet.view'])
    fetchMockKur()
    const { container } = render(<SikayetRaporPage />)

    await waitFor(() => expect(screen.getByText('Toplam şikâyet')).toBeInTheDocument())

    const metin = container.textContent ?? ''
    expect(metin).not.toMatch(/%/)
    expect(metin).not.toMatch(/yüzde/i)
    expect(metin).not.toMatch(/\boran\b/i)
  })
})

// ----------------------------------------------------------------------------
// Üç boş hâl ayrı
// ----------------------------------------------------------------------------
describe('boş ve hata hâlleri ayrı', () => {
  beforeEach(() => mockSession(['servis.sikayet.view']))

  it('kayıt yoksa "Bu dönemde kayıt yok."', async () => {
    fetchMockKur({ ...KPI, toplamSikayet: 0, reddedilenSayisi: 0, durumKirilim: [], kategoriKirilim: [], durakKirilim: [], ortalamaKapanisGunu: null, kapananKayitSayisi: 0, yenidenAcilanSayisi: 0 })
    render(<SikayetRaporPage />)
    await waitFor(() => expect(screen.getByText('Bu dönemde kayıt yok.')).toBeInTheDocument())
    expect(screen.queryByText('Bu sayfayı görüntüleme yetkiniz yok.')).not.toBeInTheDocument()
  })

  it('🔴 hata mesajı "kayıt yok" mesajından FARKLI', async () => {
    fetchMockKur(undefined, { ok: false, body: { ok: false, message: 'Performans özeti alınırken hata oluştu.' } })
    render(<SikayetRaporPage />)
    await waitFor(() => expect(screen.getByText('Performans özeti alınırken hata oluştu.')).toBeInTheDocument())
    expect(screen.queryByText('Bu dönemde kayıt yok.')).not.toBeInTheDocument()
  })

  it('üç metin birbirinden farklı', () => {
    const m = ['Bu sayfayı görüntüleme yetkiniz yok.', 'Bu dönemde kayıt yok.', 'Performans özeti alınırken hata oluştu.']
    expect(new Set(m).size).toBe(3)
  })
})
