import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import SikayetListesiPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

function mockSession(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } },
    status: 'authenticated',
  } as ReturnType<typeof useSession>)
}

const SATIR = {
  id: 's1', no: 7,
  tarih: '2026-09-20T00:00:00.000Z',
  bildirimTarihi: '2026-09-22T00:00:00.000Z',
  kategori: 'GEC_GELME',
  durum: 'AKSIYON_ALINDI' as const,
  kaynak: 'IV',
  guzergahId: 'g1',
  durakId: 'd1',
  durak: { id: 'd1', kod: 'D1', ad: 'Durak 1' },
  sikayetciPersonnelId: 'p1',
  sikayetci: { id: 'p1', sicilNo: '111', adSoyad: 'Ahmet Yolcu', bolum: 'Üretim' },
  sorumlu: { id: 'p2', sicilNo: '222', adSoyad: 'Ayşe Sorumlu', bolum: 'İV' },
}

/** Liste ucu + iki seçenek ucu için URL'e göre dağıtan fetch mock'u. */
function fetchMockKur(liste: unknown[] = [], listeYaniti?: { ok: boolean; body: unknown }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/api/servis-yonetimi/sikayet')) {
      if (listeYaniti) return { ok: listeYaniti.ok, json: async () => listeYaniti.body }
      return { ok: true, json: async () => ({ ok: true, data: liste }) }
    }
    return { ok: true, json: async () => ({ ok: true, data: [{ id: 'g1', kod: 'G1', ad: 'Hat 1' }] }) }
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function listeCagrilari(m: ReturnType<typeof fetchMockKur>): string[] {
  return m.mock.calls.map(c => c[0] as string).filter(u => u.startsWith('/api/servis-yonetimi/sikayet'))
}

beforeEach(() => {
  vi.mocked(useSession).mockReset()
})

// ----------------------------------------------------------------------------
// Yetki
// ----------------------------------------------------------------------------
describe('Şikâyet listesi — yetki', () => {
  it('servis.sikayet.view VARKEN liste render edilir ve uç çağrılır', async () => {
    mockSession(['servis.sikayet.view'])
    const m = fetchMockKur([SATIR])
    render(<SikayetListesiPage />)

    await waitFor(() => expect(screen.getByText('Ahmet Yolcu')).toBeInTheDocument())
    expect(listeCagrilari(m).length).toBeGreaterThan(0)
  })

  it('🔴 izin YOKKEN liste yok ama SAYFA render ediliyor (yanlış-negatif tuzağı yok)', async () => {
    mockSession(['servis.view'])
    const m = fetchMockKur([SATIR])
    render(<SikayetListesiPage />)

    // Sayfa başlığı DURUYOR — "hiçbir şey render olmadı" ile karışmasın
    expect(screen.getByText('Servis Şikâyetleri')).toBeInTheDocument()
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
    // Liste ve filtreler yok
    expect(screen.queryByText('Filtreler')).not.toBeInTheDocument()
    expect(screen.queryByText('Ahmet Yolcu')).not.toBeInTheDocument()
    // Uca HİÇ istek atılmadı
    expect(listeCagrilari(m)).toHaveLength(0)
  })

  it('hiç izni olmayanda da aynı (yetki yok) hâli', () => {
    mockSession([])
    fetchMockKur()
    render(<SikayetListesiPage />)
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
  })
})

// ----------------------------------------------------------------------------
// 🔴 Üç boş hâlin birbirinden AYRI olması
// ----------------------------------------------------------------------------
describe('boş hâller birbirinden ayırt ediliyor', () => {
  it('KAYIT YOK mesajı, YETKİ YOK mesajından FARKLI', async () => {
    mockSession(['servis.sikayet.view'])
    fetchMockKur([])
    render(<SikayetListesiPage />)

    await waitFor(() =>
      expect(screen.getByText('Bu filtrelerle eşleşen şikâyet kaydı yok.')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Bu sayfayı görüntüleme yetkiniz yok.')).not.toBeInTheDocument()
  })

  it('HATA mesajı, "kayıt yok" mesajından FARKLI', async () => {
    mockSession(['servis.sikayet.view'])
    fetchMockKur([], { ok: false, body: { ok: false, message: 'Şikâyet listesi alınırken hata oluştu.' } })
    render(<SikayetListesiPage />)

    await waitFor(() =>
      expect(screen.getByText('Şikâyet listesi alınırken hata oluştu.')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Bu filtrelerle eşleşen şikâyet kaydı yok.')).not.toBeInTheDocument()
    expect(screen.queryByText('Bu sayfayı görüntüleme yetkiniz yok.')).not.toBeInTheDocument()
  })

  it('üç metin birbirinin aynısı DEĞİL (sabitlendi)', () => {
    const yetki = 'Bu sayfayı görüntüleme yetkiniz yok.'
    const bos = 'Bu filtrelerle eşleşen şikâyet kaydı yok.'
    expect(new Set([yetki, bos]).size).toBe(2)
  })
})

// ----------------------------------------------------------------------------
// Sütunlar ve durum etiketi
// ----------------------------------------------------------------------------
describe('liste içeriği', () => {
  beforeEach(() => mockSession(['servis.sikayet.view']))

  it('istenen sütunlar görünüyor', async () => {
    fetchMockKur([SATIR])
    render(<SikayetListesiPage />)

    await waitFor(() => expect(screen.getByText('Ahmet Yolcu')).toBeInTheDocument())
    // Sütun başlıkları TABLOYA sınırlı aranıyor — "Güzergâh"/"Durak" aynı
    // zamanda filtre etiketleri, düz getByText ikisini birden bulurdu.
    const basliklar = screen.getAllByRole('columnheader').map(h => h.textContent)
    expect(basliklar).toEqual(['No', 'Olay tarihi', 'Bildirim tarihi', 'Güzergâh', 'Durak', 'Kategori', 'Durum', 'Şikâyetçi', 'Sorumlu'])
    // Hücre değerleri de TABLOYA sınırlı — "Geç gelme" aynı zamanda
    // kategori filtresinin <option>'u.
    const hucreler = screen.getAllByRole('cell').map(c => c.textContent)
    expect(hucreler).toContain('7')
    expect(hucreler).toContain('D1 — Durak 1')
    expect(hucreler).toContain('Geç gelme')
    expect(hucreler).toContain('Ayşe Sorumlu')
  })

  it('tarihler gün olarak gösteriliyor (saat/zaman dilimi gürültüsü yok)', async () => {
    fetchMockKur([SATIR])
    render(<SikayetListesiPage />)
    await waitFor(() => expect(screen.getByText('2026-09-20')).toBeInTheDocument())
    expect(screen.getByText('2026-09-22')).toBeInTheDocument()
  })

  it('🔴 dört durum da okunabilir TÜRKÇE ETİKETLE görünüyor (renge bağlı değil)', async () => {
    fetchMockKur([
      { ...SATIR, id: 'a', no: 1, durum: 'ACIK' as const },
      { ...SATIR, id: 'b', no: 2, durum: 'AKSIYON_ALINDI' as const },
      { ...SATIR, id: 'c', no: 3, durum: 'KAPANDI' as const },
      { ...SATIR, id: 'd', no: 4, durum: 'REDDEDILDI' as const },
    ])
    render(<SikayetListesiPage />)

    // Etiketler TABLO SATIRLARINDA aranıyor — aynı metinler filtre
    // <option>'larında da var, düz getByText onları da bulurdu.
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(4))
    const hucreMetinleri = screen.getAllByRole('cell').map(c => c.textContent)
    for (const e of ['Açık', 'Aksiyon alındı', 'Kapandı', 'Reddedildi']) {
      expect(hucreMetinleri).toContain(e)
    }
    // Ham enum adı hiçbir hücreye SIZMIYOR
    expect(hucreMetinleri.some(t => /AKSIYON_ALINDI|REDDEDILDI|ACIK|KAPANDI/.test(t ?? ''))).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// Filtreler — ekranda ikinci filtreleme YOK, uca gidiyor
// ----------------------------------------------------------------------------
describe('filtreler uca gönderiliyor', () => {
  beforeEach(() => mockSession(['servis.sikayet.view']))

  it('başlangıçta filtresiz istek atılır', async () => {
    const m = fetchMockKur([])
    render(<SikayetListesiPage />)
    await waitFor(() => expect(listeCagrilari(m).length).toBeGreaterThan(0))
    expect(listeCagrilari(m)[0]).toBe('/api/servis-yonetimi/sikayet')
  })

  it('durum filtresi değişince sorgu parametresi gider', async () => {
    const m = fetchMockKur([])
    render(<SikayetListesiPage />)
    await waitFor(() => expect(screen.getByLabelText('Durum')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Durum'), { target: { value: 'KAPANDI' } })
    await waitFor(() => expect(listeCagrilari(m).some(u => u.includes('durum=KAPANDI'))).toBe(true))
  })

  it('kategori ve kaynak filtreleri de gider', async () => {
    const m = fetchMockKur([])
    render(<SikayetListesiPage />)
    await waitFor(() => expect(screen.getByLabelText('Kategori')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'TEMIZLIK' } })
    await waitFor(() => expect(listeCagrilari(m).some(u => u.includes('kategori=TEMIZLIK'))).toBe(true))

    fireEvent.change(screen.getByLabelText('Kaynak'), { target: { value: 'PERSONEL' } })
    await waitFor(() => expect(listeCagrilari(m).some(u => u.includes('kaynak=PERSONEL'))).toBe(true))
  })

  it('🔴 tarih aralığı bildirimTarihi parametreleriyle gider (olay tarihi DEĞİL)', async () => {
    const m = fetchMockKur([])
    render(<SikayetListesiPage />)
    await waitFor(() => expect(screen.getByLabelText('Bildirim başlangıç')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Bildirim başlangıç'), { target: { value: '2026-09-01' } })
    await waitFor(() => expect(listeCagrilari(m).some(u => u.includes('bildirimBaslangic=2026-09-01'))).toBe(true))
    // `tarih=` diye bir parametre HİÇ gitmiyor
    expect(listeCagrilari(m).some(u => /[?&]tarih=/.test(u))).toBe(false)
  })

  it('durak filtresi gider', async () => {
    const m = fetchMockKur([])
    render(<SikayetListesiPage />)
    await waitFor(() => expect(screen.getByLabelText('Durak')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Durak'), { target: { value: 'g1' } })
    await waitFor(() => expect(listeCagrilari(m).some(u => u.includes('durakId=g1'))).toBe(true))
  })
})

// ----------------------------------------------------------------------------
// Adım 5A kapsamı — oluşturma/geçiş YOK
// ----------------------------------------------------------------------------
describe('Adım 5A kapsamı', () => {
  it('oluşturma butonu ve durum değiştirme aksiyonu YOK', async () => {
    mockSession(['servis.sikayet.view', 'servis.sikayet.manage'])
    fetchMockKur([SATIR])
    render(<SikayetListesiPage />)

    await waitFor(() => expect(screen.getByText('Ahmet Yolcu')).toBeInTheDocument())
    expect(screen.queryByText(/Yeni Şikâyet|Şikâyet Ekle/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /kapat|reddet|aksiyon al/i })).not.toBeInTheDocument()
  })
})
