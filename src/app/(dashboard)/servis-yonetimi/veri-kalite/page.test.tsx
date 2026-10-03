import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import VeriKaliteMerkeziPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

function mockSession(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } },
    status: 'authenticated',
  } as ReturnType<typeof useSession>)
}

function fetchOkYanit(data: unknown) {
  return { ok: true, json: async () => ({ ok: true, data }) }
}

function satir(overrides: Partial<Record<string, unknown>>) {
  return { kod: 'x', baslik: 'X', adet: 0, kayitlar: [], kirpildi: false, ...overrides }
}

beforeEach(() => {
  vi.mocked(useSession).mockReset()
  global.fetch = vi.fn() as unknown as typeof fetch
})

describe('VeriKaliteMerkeziPage — yetkilendirme', () => {
  it('servis.view izni olmayan kullanıcıya sayfa render edilmez, API hiç çağrılmaz', async () => {
    mockSession([])
    render(<VeriKaliteMerkeziPage />)

    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
    expect(screen.queryByText('Veri Kalite Merkezi')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı sayfayı görür ve API çağrılır', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit([])) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    expect(screen.getByText('Veri Kalite Merkezi')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/servis-yonetimi/veri-kalite'))
  })
})

describe('VeriKaliteMerkeziPage — kart render', () => {
  it('adet=0 olan kart için "Sorun bulunmadı" olumlu boş-durum mesajı gösterir', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(
      fetchOkYanit([satir({ kod: 'koordinatsiz-durak', baslik: 'Koordinatsız durak', adet: 0, kayitlar: [] })]),
    ) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    await waitFor(() => expect(screen.getByText('Koordinatsız durak')).toBeInTheDocument())
    expect(screen.getByText('Sorun bulunmadı.')).toBeInTheDocument()
  })

  it('adet>0 olan kart bulunan kayıtları ve gerçek adedi listeler', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(
      fetchOkYanit([
        satir({
          kod: 'aktif-personel-servis-yok',
          baslik: 'Aktif personel / servis yok',
          adet: 2,
          kayitlar: [
            { id: 'p1', sicilNo: '111', adSoyad: 'Ahmet Yılmaz', bolum: 'Üretim' },
            { id: 'p2', sicilNo: '222', adSoyad: 'Ayşe Kaya', bolum: 'Kalite' },
          ],
        }),
      ]),
    ) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    await waitFor(() => expect(screen.getByText(/Ahmet Yılmaz/)).toBeInTheDocument())
    expect(screen.getByText(/Ayşe Kaya/)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // adet rozeti
    const link = screen.getByText(/Ahmet Yılmaz/).closest('a')
    expect(link).toHaveAttribute('href', '/personnel/p1')
  })

  it('kirpildi=true olan kartta "İlk N kayıt gösteriliyor, toplam M" notu gösterir', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(
      fetchOkYanit([
        satir({
          kod: 'koordinatsiz-durak',
          baslik: 'Koordinatsız durak',
          adet: 250,
          kirpildi: true,
          kayitlar: Array.from({ length: 200 }, (_, i) => ({ id: `d${i}`, kod: `D${i}`, ad: `Durak ${i}`, aktifGuzergahaBagli: false })),
        }),
      ]),
    ) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    await waitFor(() => expect(screen.getByText('İlk 200 kayıt gösteriliyor, toplam 250.')).toBeInTheDocument())
  })
})

describe('VeriKaliteMerkeziPage — kısmi hata (allSettled UI karşılığı)', () => {
  it('bir kart hata durumundayken diğer kartlar sağlam render edilir', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(
      fetchOkYanit([
        satir({ kod: 'aktif-personel-servis-yok', baslik: 'Aktif personel / servis yok', hata: 'DB bağlantı hatası' }),
        satir({ kod: 'koordinatsiz-durak', baslik: 'Koordinatsız durak', adet: 0, kayitlar: [] }),
      ]),
    ) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    await waitFor(() => expect(screen.getByText(/Bu kontrol çalıştırılamadı: DB bağlantı hatası/)).toBeInTheDocument())
    // Diğer kart etkilenmeden, normal boş-durum mesajıyla render edilir.
    expect(screen.getByText('Koordinatsız durak')).toBeInTheDocument()
    expect(screen.getByText('Sorun bulunmadı.')).toBeInTheDocument()
  })
})

describe('VeriKaliteMerkeziPage — kapsamDisi kartlar', () => {
  it('kapsamDisi=true olan kart gri/notlu gösterilir, hata fırlatmaz', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(
      fetchOkYanit([
        satir({
          kod: 'vardiya-uyumsuzlugu',
          baslik: 'Vardiya uyumsuzluğu',
          kapsamDisi: true,
          not: 'Güvenilir bir eşleştirme kurulamıyor.',
        }),
      ]),
    ) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    await waitFor(() => expect(screen.getByText('Vardiya uyumsuzluğu')).toBeInTheDocument())
    expect(screen.getByText('Güvenilir bir eşleştirme kurulamıyor.')).toBeInTheDocument()
    // kapsamDışı kartta adet rozeti/boş-durum mesajı YOK — ayrı bir render dalı.
    expect(screen.queryByText('Sorun bulunmadı.')).not.toBeInTheDocument()
  })
})

describe('VeriKaliteMerkeziPage — API hatası', () => {
  it('API hata döndürürse hata mesajı gösterilir, sayfa çökmez', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, message: 'Sunucu hatası.' }) }) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    await waitFor(() => expect(screen.getByText('Sunucu hatası.')).toBeInTheDocument())
  })
})

// ----------------------------------------------------------------------------
// 🔴 Excel export butonu — servis.export AYRI eksen (uç de AND istiyor)
// ----------------------------------------------------------------------------
describe('VeriKaliteMerkeziPage — Excel export butonu', () => {
  const EXPORT_YOLU = '/api/servis-yonetimi/veri-kalite/export'

  it('servis.export izni VARKEN buton render edilir ve href doğrudur', async () => {
    mockSession(['servis.view', 'servis.export'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit([])) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    const buton = await screen.findByText('Excel indir')
    const bag = buton.closest('a')
    expect(bag).toHaveAttribute('href', EXPORT_YOLU)
    // Düz <a> olmalı — <Button asChild> bozuk olduğu için <button><a></a>
    // üretirdi; o geçersiz HTML'i çoğaltmadığımızı sabitliyoruz.
    expect(bag?.closest('button')).toBeNull()
  })

  it('🔴 servis.export izni YOKKEN buton HİÇ render edilmez (sayfa yine görünür)', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit([])) as unknown as typeof fetch

    render(<VeriKaliteMerkeziPage />)

    // Sayfanın kendisi görünüyor — "grup kapalı olduğu için göremedi"
    // yanlış-negatifi eleniyor.
    expect(screen.getByText('Veri Kalite Merkezi')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    expect(screen.queryByText('Excel indir')).not.toBeInTheDocument()
    expect(document.querySelector(`a[href="${EXPORT_YOLU}"]`)).toBeNull()
  })

  it('🔴 YALNIZ servis.export (view yok) → ne sayfa ne buton (export görüntülemeye bağlı)', () => {
    mockSession(['servis.export'])
    render(<VeriKaliteMerkeziPage />)
    expect(screen.queryByText('Excel indir')).not.toBeInTheDocument()
    expect(document.querySelector(`a[href="${EXPORT_YOLU}"]`)).toBeNull()
  })

  it('hiç izni olmayan kullanıcıda ne sayfa ne buton render edilir', () => {
    mockSession([])
    render(<VeriKaliteMerkeziPage />)

    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
    expect(screen.queryByText('Excel indir')).not.toBeInTheDocument()
  })
})

describe('VeriKaliteMerkeziPage — dilimsiz personel ataması kartı (B4)', () => {
  const kontrol = (adet: number) =>
    satir({
      kod: 'personel-atamasi-dilimsiz',
      baslik: 'Sefer dilimi bağlantısı olmayan personel ataması',
      adet,
      kayitlar: adet === 0 ? [] : [
        { atamaId: 'a1', guzergahId: 'g1', guzergahKod: 'DARICA', guzergahAd: 'Darıca', baslangicTarihi: '2026-09-27', kaynak: 'IMPORT' },
      ],
    })

  it('N > 0: Türkçe başlık, kayıt etiketi ve güzergâh bağlantısı', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit([kontrol(63)])) as unknown as typeof fetch
    render(<VeriKaliteMerkeziPage />)
    await waitFor(() => expect(screen.getByText('Sefer dilimi bağlantısı olmayan personel ataması')).toBeInTheDocument())
    const kayit = screen.getByText('DARICA — Darıca (IMPORT, 2026-09-27 başlangıçlı)')
    expect(kayit.closest('a')?.getAttribute('href')).toBe('/servis-yonetimi/guzergah/g1?sekme=personel-atama&dilimsiz=1')
  })

  it('N = 0: olumlu boş durum', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit([kontrol(0)])) as unknown as typeof fetch
    render(<VeriKaliteMerkeziPage />)
    await waitFor(() => expect(screen.getByText('Sefer dilimi bağlantısı olmayan personel ataması')).toBeInTheDocument())
    expect(screen.getByText('Sorun bulunmadı.')).toBeInTheDocument()
  })
})

describe('VeriKaliteMerkeziPage — pasif güzergâha bağlı aktif atama kartı (C4)', () => {
  const kontrol = (adet: number) =>
    satir({
      kod: 'pasif-guzergah-aktif-atama', baslik: 'Pasif güzergâha bağlı aktif atama', adet,
      kayitlar: adet === 0 ? [] : [{ atamaId: 'a1', guzergahId: 'g7', guzergahKod: 'ESKİ_ÜSKÜDAR', guzergahAd: 'Eski Üsküdar', baslangicTarihi: '2026-09-27', kaynak: 'IMPORT' }],
    })

  it('N > 0: Türkçe başlık, kayıt etiketi ve güzergâh bağlantısı', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit([kontrol(2)])) as unknown as typeof fetch
    render(<VeriKaliteMerkeziPage />)
    await waitFor(() => expect(screen.getByText('Pasif güzergâha bağlı aktif atama')).toBeInTheDocument())
    const kayit = screen.getByText('ESKİ_ÜSKÜDAR — Eski Üsküdar (pasif güzergâh, IMPORT, 2026-09-27 başlangıçlı)')
    expect(kayit.closest('a')?.getAttribute('href')).toBe('/servis-yonetimi/guzergah/g7')
  })

  it('N = 0: olumlu boş durum', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit([kontrol(0)])) as unknown as typeof fetch
    render(<VeriKaliteMerkeziPage />)
    await waitFor(() => expect(screen.getByText('Pasif güzergâha bağlı aktif atama')).toBeInTheDocument())
    expect(screen.getByText('Sorun bulunmadı.')).toBeInTheDocument()
  })
})
