import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import OperasyonelServisListesiPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

function mockSession(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } },
    status: 'authenticated',
  } as ReturnType<typeof useSession>)
}

const BOS_SONUC = { tarih: '2026-09-22', gecmisTarihSecildi: false, satirlar: [] }

const ORNEK_SATIR = {
  personnelId: 'p1',
  sicilNo: '111',
  adSoyad: 'Ahmet Yılmaz',
  bolum: 'Üretim',
  guzergahKod: 'G1',
  guzergahAd: 'Güzergah 1',
  durakKod: 'D1',
  durakAd: 'Durak 1',
  sabahSaati: '07:15',
  telefon: '5551112233',
}

/** Liste ucu + 4 seçenek ucu için URL'e göre dağıtan fetch mock'u. */
function fetchMockKur(listeVerisi: unknown = BOS_SONUC) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/api/servis-yonetimi/operasyonel-servis-listesi?')) {
      return { ok: true, json: async () => ({ ok: true, data: listeVerisi }) }
    }
    // güzergah/firma/durak/yerleşke seçenek listeleri
    return { ok: true, json: async () => ({ ok: true, data: [] }) }
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function listeCagrilari(fetchMock: ReturnType<typeof fetchMockKur>): string[] {
  return fetchMock.mock.calls
    .map(c => c[0] as string)
    .filter(u => u.startsWith('/api/servis-yonetimi/operasyonel-servis-listesi?'))
}

beforeEach(() => {
  vi.mocked(useSession).mockReset()
  global.fetch = vi.fn() as unknown as typeof fetch
})

describe('OperasyonelServisListesiPage — yetkilendirme', () => {
  it('servis.view izni olmayan kullanıcıya ekran render edilmez, API hiç çağrılmaz', () => {
    mockSession([])
    render(<OperasyonelServisListesiPage />)

    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
    expect(screen.queryByText('Operasyonel Servis Listesi')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı ekranı görür ve liste ucu çağrılır', async () => {
    mockSession(['servis.view'])
    const fetchMock = fetchMockKur()

    render(<OperasyonelServisListesiPage />)

    expect(screen.getByText('Operasyonel Servis Listesi')).toBeInTheDocument()
    await waitFor(() => expect(listeCagrilari(fetchMock).length).toBeGreaterThan(0))
  })
})

// ----------------------------------------------------------------------------
// 🔴 servis.view var / servis.export yok (idari-isler): liste görünür ama
// indirme butonları HİÇ render edilmez.
// ----------------------------------------------------------------------------
describe('OperasyonelServisListesiPage — export butonu yetkisi', () => {
  it('servis.export izni YOKKEN Excel/PDF butonları render EDİLMEZ (liste görünür)', async () => {
    mockSession(['servis.view'])
    fetchMockKur()

    render(<OperasyonelServisListesiPage />)

    await waitFor(() => expect(screen.getByText('Operasyonel Servis Listesi')).toBeInTheDocument())
    expect(screen.queryByText('Excel')).not.toBeInTheDocument()
    expect(screen.queryByText('PDF')).not.toBeInTheDocument()
  })

  it('servis.export izni VARKEN Excel/PDF butonları o anki filtrelerle render edilir', async () => {
    mockSession(['servis.view', 'servis.export'])
    fetchMockKur()

    render(<OperasyonelServisListesiPage />)

    const excel = await screen.findByText('Excel')
    const pdf = screen.getByText('PDF')
    expect(excel.closest('a')?.getAttribute('href')).toContain('/operasyonel-servis-listesi/export?')
    expect(pdf.closest('a')?.getAttribute('href')).toContain('/operasyonel-servis-listesi/export-pdf?')
    // Varsayılan tarih filtresi bağlantıya da taşınır.
    expect(excel.closest('a')?.getAttribute('href')).toContain('tarih=')
  })
})

describe('OperasyonelServisListesiPage — filtreler', () => {
  it('açılışta varsayılan tarih (bugün) ile çağrılır', async () => {
    mockSession(['servis.view'])
    const fetchMock = fetchMockKur()

    render(<OperasyonelServisListesiPage />)

    const bugun = new Date().toISOString().slice(0, 10)
    await waitFor(() => expect(listeCagrilari(fetchMock)[0]).toContain(`tarih=${bugun}`))
  })

  it('tarih değişince YENİDEN ve doğru query param ile çağrılır', async () => {
    mockSession(['servis.view'])
    const fetchMock = fetchMockKur()

    render(<OperasyonelServisListesiPage />)
    await waitFor(() => expect(listeCagrilari(fetchMock).length).toBe(1))

    fireEvent.change(screen.getByLabelText('Tarih'), { target: { value: '2026-06-01' } })

    await waitFor(() => expect(listeCagrilari(fetchMock).length).toBe(2))
    expect(listeCagrilari(fetchMock)[1]).toContain('tarih=2026-06-01')
  })

  it('bölüm filtresi değişince query param olarak iletilir', async () => {
    mockSession(['servis.view'])
    const fetchMock = fetchMockKur()

    render(<OperasyonelServisListesiPage />)
    await waitFor(() => expect(listeCagrilari(fetchMock).length).toBe(1))

    fireEvent.change(screen.getByLabelText('Bölüm'), { target: { value: 'Üretim' } })

    await waitFor(() => expect(listeCagrilari(fetchMock).length).toBe(2))
    expect(listeCagrilari(fetchMock)[1]).toContain('bolum=')
  })

  it('MASTER\'daki vardiya ve şirket filtreleri (veri kaynağı yok) render EDİLMEZ', async () => {
    mockSession(['servis.view'])
    fetchMockKur()

    render(<OperasyonelServisListesiPage />)

    await waitFor(() => expect(screen.getByLabelText('Tarih')).toBeInTheDocument())
    expect(screen.queryByLabelText('Vardiya')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Şirket')).not.toBeInTheDocument()
  })
})

describe('OperasyonelServisListesiPage — geçmiş tarih uyarısı', () => {
  it('gecmisTarihSecildi=true ise tablonun üstünde uyarı bandı görünür', async () => {
    mockSession(['servis.view'])
    fetchMockKur({ tarih: '2020-01-01', gecmisTarihSecildi: true, satirlar: [] })

    render(<OperasyonelServisListesiPage />)

    await waitFor(() =>
      expect(
        screen.getByText(/Personel listesi 01\.01\.2020 itibarıyla; saat ve durak bilgileri güncel tanımlara göredir\./),
      ).toBeInTheDocument(),
    )
  })

  it('gecmisTarihSecildi=false ise uyarı bandı görünmez', async () => {
    mockSession(['servis.view'])
    fetchMockKur()

    render(<OperasyonelServisListesiPage />)

    await waitFor(() => expect(screen.getByText('Sicil')).toBeInTheDocument())
    expect(screen.queryByText(/itibarıyla; saat ve durak bilgileri/)).not.toBeInTheDocument()
  })
})

describe('OperasyonelServisListesiPage — liste içeriği', () => {
  it('sonuç boşsa boş-durum mesajı gösterilir', async () => {
    mockSession(['servis.view'])
    fetchMockKur()

    render(<OperasyonelServisListesiPage />)

    await waitFor(() =>
      expect(screen.getByText('Seçilen filtrelerle servis kullanan personel bulunamadı.')).toBeInTheDocument(),
    )
  })

  it('satır varsa tabloda tüm sütunlarla (telefon dahil) listelenir', async () => {
    mockSession(['servis.view'])
    fetchMockKur({ tarih: '2026-09-22', gecmisTarihSecildi: false, satirlar: [ORNEK_SATIR] })

    render(<OperasyonelServisListesiPage />)

    await waitFor(() => expect(screen.getByText('Ahmet Yılmaz')).toBeInTheDocument())
    expect(screen.getByText('111')).toBeInTheDocument()
    expect(screen.getByText('Üretim')).toBeInTheDocument()
    expect(screen.getByText('G1 — Güzergah 1')).toBeInTheDocument()
    expect(screen.getByText('D1 — Durak 1')).toBeInTheDocument()
    expect(screen.getByText('07:15')).toBeInTheDocument()
    expect(screen.getByText('5551112233')).toBeInTheDocument()
    expect(screen.queryByText('Seçilen filtrelerle servis kullanan personel bulunamadı.')).not.toBeInTheDocument()
  })

  it('API hata döndürürse hata mesajı gösterilir, ekran çökmez', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn(async (url: string) => {
      if (url.startsWith('/api/servis-yonetimi/operasyonel-servis-listesi?')) {
        return { ok: false, json: async () => ({ ok: false, message: 'Sunucu hatası.' }) }
      }
      return { ok: true, json: async () => ({ ok: true, data: [] }) }
    }) as unknown as typeof fetch

    render(<OperasyonelServisListesiPage />)

    await waitFor(() => expect(screen.getByText('Sunucu hatası.')).toBeInTheDocument())
  })
})
