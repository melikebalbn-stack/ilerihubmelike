import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import AcilDurumListesiPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

function mockSession(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } },
    status: 'authenticated',
  } as ReturnType<typeof useSession>)
}

const bosBlok = () => ({ durum: 'ATANMAMIS' as const, kayitlar: [] })

const ORNEK_SONUC = {
  tarih: '2026-09-22',
  guzergah: { id: 'g1', kod: 'G1', ad: 'Gebze Hattı', yerleskeKod: 'Y1', yerleskeAd: 'Merkez' },
  dilim: { id: 'd1', kod: 'SABAH_GIDIS', ad: 'Sabah Servisi', yon: 'GIDIS' },
  seferTanimli: true,
  duraklar: {
    durum: 'VERI_VAR' as const,
    kayitlar: [
      { sira: 1, durakId: 'dr1', durakKod: 'D1', durakAd: 'Durak 1', il: 'Kocaeli', ilce: 'Gebze', saat: '07:15' },
    ],
  },
  arac: {
    ana: { durum: 'VERI_VAR' as const, kayitlar: [{ aracId: 'a1', plaka: '41 AB 1', kapasite: 27, firmaId: 'f1', firmaAd: 'Firma A' }] },
    yedek: bosBlok(),
  },
  sofor: {
    ana: {
      durum: 'VERI_VAR' as const,
      kayitlar: [{ soforId: 's1', adSoyad: 'Mehmet Şoför', telefon: '0532 111 22 33', dahiliMi: true, personnelId: 'p-sofor' }],
    },
    yedek: bosBlok(),
  },
  sorumlu: {
    ana: {
      durum: 'VERI_VAR' as const,
      kayitlar: [{ personnelId: 'p-sorumlu', sicilNo: '999', adSoyad: 'Ayşe Sorumlu', telefon: '0533 444 55 66' }],
    },
    yedek: bosBlok(),
  },
  firmalar: {
    durum: 'VERI_VAR' as const,
    kayitlar: [{ firmaId: 'f1', ad: 'Firma A', yetkiliAdi: 'Yetkili Kişi', telefon: '0262 777 88 99', eposta: 'a@x.com' }],
  },
  yolcular: {
    durum: 'VERI_VAR' as const,
    kayitlar: [
      { personnelId: 'p1', sicilNo: '111', adSoyad: 'Ahmet Yolcu', durakKod: 'D1', durakAd: 'Durak 1', telefon: '0505 123 45 67' },
      { personnelId: 'p2', sicilNo: '222', adSoyad: 'Zeynep Yolcu', durakKod: 'D1', durakAd: 'Durak 1', telefon: null },
    ],
  },
}

function fetchMockKur(sonuc: unknown = ORNEK_SONUC) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/api/servis-yonetimi/acil-durum-listesi?')) {
      return { ok: true, json: async () => ({ ok: true, data: sonuc }) }
    }
    if (url.startsWith('/api/servis-yonetimi/guzergah')) {
      return { ok: true, json: async () => ({ ok: true, data: [{ id: 'g1', kod: 'G1', ad: 'Gebze Hattı' }] }) }
    }
    return { ok: true, json: async () => ({ ok: true, data: [{ id: 'd1', kod: 'SABAH_GIDIS', ad: 'Sabah Servisi' }] }) }
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

/**
 * Güzergâh + dilim seçildiğinde ekran kendiliğinden veriyi çeker.
 * <select> etiketiyle HEMEN render edilir; seçenekler ise iki ardışık fetch'ten sonra gelir.
 * Seçenek henüz yokken fireEvent.change değeri yutulur (jsdom, olmayan option'ı seçmez) →
 * seçenekler gelmeden değiştirmek yük altında kararsızlığın kök nedeniydi.
 */
async function seciminiYap() {
  await waitFor(() => {
    expect(screen.getByLabelText('Güzergâh').querySelector('option[value="g1"]')).not.toBeNull()
    expect(screen.getByLabelText('Sefer Dilimi').querySelector('option[value="d1"]')).not.toBeNull()
  })
  fireEvent.change(screen.getByLabelText('Güzergâh'), { target: { value: 'g1' } })
  fireEvent.change(screen.getByLabelText('Sefer Dilimi'), { target: { value: 'd1' } })
}

beforeEach(() => {
  vi.mocked(useSession).mockReset()
  fetchMockKur()
})

// ----------------------------------------------------------------------------
// 🔴 Yetki — sayfa/API guard'ıyla birebir AND
// ----------------------------------------------------------------------------
describe('Acil Durum Servis Listesi ekranı — yetki', () => {
  it("🔴 servis.view'i OLAN ama servis.kvkk.view'i OLMAYAN kullanıcıda ekran RENDER EDİLMEZ ve veri hiç istenmez", async () => {
    mockSession(['servis.view'])
    const fetchMock = fetchMockKur()
    render(<AcilDurumListesiPage />)

    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
    expect(screen.queryByText('Acil Durum Servis Listesi')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Güzergâh')).not.toBeInTheDocument()
    // KVKK: yetkisiz kullanıcı için uçlara HİÇ dokunulmaz (erişim izi de yazılmaz).
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("servis.kvkk.view'i OLAN ama servis.view'i OLMAYAN kullanıcıda da ekran RENDER EDİLMEZ (AND iki yönlü)", () => {
    mockSession(['servis.kvkk.view'])
    render(<AcilDurumListesiPage />)
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
  })

  it('izinsiz kullanıcıda ekran RENDER EDİLMEZ', () => {
    mockSession([])
    render(<AcilDurumListesiPage />)
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
  })

  it('İKİ izne birden sahip kullanıcı ekranı GÖRÜR', async () => {
    mockSession(['servis.view', 'servis.kvkk.view'])
    render(<AcilDurumListesiPage />)
    expect(screen.getByText('Acil Durum Servis Listesi')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Güzergâh')).toBeInTheDocument())
  })
})

// ----------------------------------------------------------------------------
// İçerik
// ----------------------------------------------------------------------------
describe('Acil Durum Servis Listesi ekranı — içerik', () => {
  beforeEach(() => mockSession(['servis.view', 'servis.kvkk.view']))

  it('seçim yapılmadan veri istenmez, yönlendirme metni gösterilir', async () => {
    const fetchMock = fetchMockKur()
    render(<AcilDurumListesiPage />)

    expect(screen.getByText('Güzergâh ve sefer dilimi seçin.')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const listeCagrilari = fetchMock.mock.calls
      .map(c => c[0] as string)
      .filter(u => u.startsWith('/api/servis-yonetimi/acil-durum-listesi?'))
    expect(listeCagrilari).toHaveLength(0)
  })

  it('güzergâh + dilim seçilince uca doğru parametrelerle istek atılır', async () => {
    const fetchMock = fetchMockKur()
    render(<AcilDurumListesiPage />)
    await seciminiYap()

    await waitFor(() => {
      const cagri = fetchMock.mock.calls
        .map(c => c[0] as string)
        .find(u => u.startsWith('/api/servis-yonetimi/acil-durum-listesi?'))
      expect(cagri).toContain('guzergahId=g1')
      expect(cagri).toContain('dilimId=d1')
    })
  })

  it('acil durum sırasıyla beş blok da basılır ve yolcu SAYISI başlıkta görünür', async () => {
    render(<AcilDurumListesiPage />)
    await seciminiYap()

    await waitFor(() => expect(screen.getByText('41 AB 1', { exact: false })).toBeInTheDocument())
    expect(screen.getByText('1 · Araç')).toBeInTheDocument()
    expect(screen.getByText('1 · Şoför')).toBeInTheDocument()
    expect(screen.getByText('2 · Güzergâh Sorumlusu')).toBeInTheDocument()
    expect(screen.getByText('3 · Taşeron Firma İletişimi')).toBeInTheDocument()
    expect(screen.getByText('4 · Beklenen Yolcular (2)')).toBeInTheDocument()
    expect(screen.getByText('5 · Duraklar')).toBeInTheDocument()

    expect(screen.getByText('Mehmet Şoför')).toBeInTheDocument()
    expect(screen.getByText('Ayşe Sorumlu')).toBeInTheDocument()
    expect(screen.getByText('Ahmet Yolcu')).toBeInTheDocument()
  })

  it('🔴 TÜM telefonlar tel: bağlantısı — şoför, sorumlu, firma ve yolcu', async () => {
    render(<AcilDurumListesiPage />)
    await seciminiYap()

    await waitFor(() => expect(screen.getByText('0532 111 22 33')).toBeInTheDocument())
    for (const [metin, numara] of [
      ['0532 111 22 33', '05321112233'], // şoför
      ['0533 444 55 66', '05334445566'], // sorumlu
      ['0262 777 88 99', '02627778899'], // firma
      ['0505 123 45 67', '05051234567'], // yolcu
    ]) {
      expect(screen.getByText(metin).closest('a')).toHaveAttribute('href', `tel:${numara}`)
    }
    // Telefonu olmayan yolcu sessizce boş bırakılmaz.
    expect(screen.getByText('telefon yok')).toBeInTheDocument()
  })

  it('ANA ve YEDEK ayrı ayrı görünür; YEDEK yoksa "— ATANMAMIŞ —" basılır (sessiz boşluk yok)', async () => {
    render(<AcilDurumListesiPage />)
    await seciminiYap()

    await waitFor(() => expect(screen.getAllByText('ANA').length).toBeGreaterThan(0))
    // Araç + Şoför + Sorumlu = 3 rollü blok
    expect(screen.getAllByText('ANA')).toHaveLength(3)
    expect(screen.getAllByText('YEDEK')).toHaveLength(3)
    // Üçünün de yedeği boş → 3 ATANMAMIŞ uyarısı
    expect(screen.getAllByText('— ATANMAMIŞ —')).toHaveLength(3)
  })

  it('sefer tanımlı değilse durum bloğu uyarı metniyle görünür ve ekran çökmez', async () => {
    fetchMockKur({
      ...ORNEK_SONUC,
      seferTanimli: false,
      duraklar: { durum: 'SEFER_TANIMLI_DEGIL' as const, kayitlar: [] },
      arac: { ana: bosBlok(), yedek: bosBlok() },
      sofor: { ana: bosBlok(), yedek: bosBlok() },
      sorumlu: { ana: bosBlok(), yedek: bosBlok() },
      firmalar: bosBlok(),
      yolcular: bosBlok(),
    })
    render(<AcilDurumListesiPage />)
    await seciminiYap()

    await waitFor(() => expect(screen.getByText('Bu dilimde sefer tanımlı değil.')).toBeInTheDocument())
    expect(screen.getByText(/sefer yapmıyor görünüyor/)).toBeInTheDocument()
    expect(screen.getByText('4 · Beklenen Yolcular (0)')).toBeInTheDocument()
  })

  it('PDF bağlantısı seçili parametrelerle export-pdf ucuna gider', async () => {
    render(<AcilDurumListesiPage />)
    await seciminiYap()

    await waitFor(() => expect(screen.getByText('PDF')).toBeInTheDocument())
    const href = screen.getByText('PDF').closest('a')!.getAttribute('href')!
    expect(href).toContain('/api/servis-yonetimi/acil-durum-listesi/export-pdf?')
    expect(href).toContain('guzergahId=g1')
    expect(href).toContain('dilimId=d1')
  })

  it('uç hata dönerse mesaj gösterilir, ekran çökmez', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/servis-yonetimi/acil-durum-listesi?')) {
        return { ok: false, json: async () => ({ ok: false, message: 'Güzergâh bulunamadı.' }) }
      }
      if (url.startsWith('/api/servis-yonetimi/guzergah')) {
        return { ok: true, json: async () => ({ ok: true, data: [{ id: 'g1', kod: 'G1', ad: 'Gebze Hattı' }] }) }
      }
      return { ok: true, json: async () => ({ ok: true, data: [{ id: 'd1', kod: 'SABAH_GIDIS', ad: 'Sabah Servisi' }] }) }
    })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AcilDurumListesiPage />)
    await seciminiYap()

    await waitFor(() => expect(screen.getByText('Güzergâh bulunamadı.')).toBeInTheDocument())
  })
})
