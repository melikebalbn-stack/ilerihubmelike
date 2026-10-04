import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import PersonelAtamaExcelPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

const oturum = (permissions: string[]) =>
  vi.mocked(useSession).mockReturnValue({ data: { user: { permissions } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)

const satir = (o: object) => ({ satirNo: 2, sicil: '101', adSoyad: 'Çağlar Şahin', guzergahKod: 'DARICA', durakKod: 'DK-01', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: '2026-10-01', tur: 'YENI', hata: null, ...o })
const etki = (o: object = {}) => ({ dilimId: 'd1', dilimKod: 'SABAH_GIDIŞ', dilimAd: 'S', guzergahId: 'g1', guzergahKod: 'DARICA', once: 8, sonra: 9, koltuk: 10, aracYok: false, asim: false, fazla: 0, ...o })
const ONIZLEME = {
  ozet: { toplamSatir: 4, yeni: 1, degisiklik: 1, dilimEkle: 1, degismeyen: 0, hatali: 1, kapasiteUyarisi: 0 },
  satirlar: [
    satir({ satirNo: 2 }),
    satir({ satirNo: 3, sicil: '102', adSoyad: 'İlker Öztürk', guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01', tur: 'DEGISIKLIK' }),
    satir({ satirNo: 4, sicil: '103', adSoyad: 'Şule Ğündoğdu', guzergahKod: '', durakKod: '', tur: 'YALNIZ_DILIM' }),
    satir({ satirNo: 5, sicil: '999', adSoyad: null, tur: 'HATA', hata: 'Sicil bulunamadı: 999.' }),
  ],
  etki: [etki()], asimVar: false, limitler: { maksSatir: 300, maksDosyaBayt: 2097152 },
}
const SONUC = { topluIslemId: 'toplu-123', yeni: 1, degisiklik: 1, dilimEkle: 1, degismeyen: 0, atlanan: 1 }

type Cevap = { status?: number; body: unknown }
let cevap: Record<string, Cevap>
let fetchMock: ReturnType<typeof vi.fn>
const cagrilar = (parca: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(parca))
const formDegeri = (c: unknown[], k: string) => ((c[1] as RequestInit).body as FormData).get(k)

function dosyaSec(ad = 'atamalar.xlsx', boyut = 1000) {
  const f = new File(['x'], ad, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  Object.defineProperty(f, 'size', { value: boyut })
  fireEvent.change(screen.getByLabelText('Excel dosyası'), { target: { files: [f] } })
  return f
}
async function onizleAc() {
  render(<PersonelAtamaExcelPage />)
  dosyaSec()
  fireEvent.click(screen.getByRole('button', { name: /Önizle/ }))
  await screen.findByText(/2\. Önizleme — 4 satır/)
}

beforeEach(() => {
  cevap = { onizleme: { body: { ok: true, data: ONIZLEME } }, uygula: { body: { ok: true, data: SONUC } } }
  fetchMock = vi.fn(async (url: string) => {
    for (const [p, c] of Object.entries(cevap)) if (String(url).includes(p)) return { ok: (c.status ?? 200) < 400, status: c.status ?? 200, json: async () => c.body, blob: async () => new Blob(['x']) }
    return { ok: true, status: 200, json: async () => ({ ok: true }), blob: async () => new Blob(['x']) }
  })
  vi.stubGlobal('fetch', fetchMock)
  oturum(['servis.view', 'servis.edit'])
})
afterEach(() => vi.unstubAllGlobals())

describe('yetki (sayfa katmanı)', () => {
  it('🔴 yalnız servis.view / yalnız servis.edit / izinsiz → içerik YOK, istek YOK', () => {
    for (const izin of [['servis.view'], ['servis.edit'], []]) {
      oturum(izin)
      const { unmount } = render(<PersonelAtamaExcelPage />)
      expect(screen.getByText(/yetkiniz yok/)).toBeTruthy()
      expect(screen.queryByLabelText('Excel dosyası')).toBeNull()
      unmount()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('1. Dosya yükle', () => {
  it('şablon bağlantısı, kurallar (dilim zorunlu), adımlar; Önizle dosya seçilene kadar kapalı', () => {
    render(<PersonelAtamaExcelPage />)
    expect(screen.getByRole('link', { name: /Şablonu indir/ }).getAttribute('href')).toBe('/api/servis-yonetimi/personel-atama-excel/sablon')
    expect(screen.getByText(/Sefer dilimi zorunludur/)).toBeTruthy()
    // sınırlar tek kaynaktan (excel-atama-limitleri.ts) — metinde 300 satır / 2 MB
    expect(document.body.textContent).toContain('En fazla 300 satır (başlık hariç), 2 MB')
    expect(screen.getByLabelText('Adımlar').textContent).toContain('1. Dosya yükle')
    expect((screen.getByRole('button', { name: /Önizle/ }) as HTMLButtonElement).disabled).toBe(true)
    dosyaSec()
    expect((screen.getByRole('button', { name: /Önizle/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('kullanıcı hatası: .xlsx olmayan ve 2 MB üstü dosya reddedilir (Türkçe mesaj), istek atılmaz', () => {
    render(<PersonelAtamaExcelPage />)
    dosyaSec('liste.csv')
    expect(screen.getByRole('alert').textContent).toContain('Yalnız .xlsx')
    dosyaSec('dev.xlsx', 3 * 1024 * 1024)
    expect(screen.getByRole('alert').textContent).toContain('çok büyük')
    expect((screen.getByRole('button', { name: /Önizle/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('2. Önizleme', () => {
  it('özet kartları, satır tablosu (satır no, sicil, ad soyad, güzergâh, durak, sonuç), Türkçe adlar', async () => {
    await onizleAc()
    expect(screen.getByTestId('ozet-Yeni atama').textContent).toBe('1')
    expect(screen.getByTestId('ozet-Değişiklik').textContent).toBe('1')
    expect(screen.getByTestId('ozet-Dilim ekleme').textContent).toBe('1')
    expect(screen.getByTestId('ozet-Hatalı satır').textContent).toBe('1')
    expect(screen.getByTestId('ozet-Kapasite uyarısı').textContent).toBe('0')
    const satirlar = screen.getAllByRole('row').slice(1)
    expect(satirlar).toHaveLength(4)
    expect(satirlar[1].textContent).toContain('İlker Öztürk')
    expect(satirlar[1].textContent).toContain('ÜSKÜDAR')
    expect(satirlar[1].textContent).toContain('Güzergâh/durak değişikliği')
    expect(satirlar[2].textContent).toContain('Şule Ğündoğdu')
    expect(satirlar[2].textContent).toContain('Yalnız dilim ekleme')
    expect(satirlar[3].textContent).toContain('Sicil bulunamadı: 999.')
    expect(cagrilar('onizleme')).toHaveLength(1)
    expect(cagrilar('uygula')).toHaveLength(0) // önizleme yazmaz
  })

  it('kapasite etkisi listesi: "güzergâh — dilim: personel a → b / koltuk k"', async () => {
    await onizleAc()
    expect(screen.getByTestId('kapasite-etkisi').textContent).toContain('DARICA — SABAH_GIDIŞ: personel 8 → 9 / koltuk 10')
  })

  it('"Yalnız hatalı satırlar" filtresi; hata raporu düğmesi yalnız hatalı satır varken', async () => {
    await onizleAc()
    fireEvent.click(screen.getByLabelText('Yalnız hatalı satırlar'))
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Hata raporunu indir/ })).toBeTruthy()
  })

  it('hata raporu: aynı dosya hata-raporu ucuna gönderilir ve indirme tetiklenir', async () => {
    const olustur = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: olustur, revokeObjectURL: vi.fn() })
    await onizleAc()
    fireEvent.click(screen.getByRole('button', { name: /Hata raporunu indir/ }))
    await waitFor(() => expect(cagrilar('hata-raporu')).toHaveLength(1))
    expect(olustur).toHaveBeenCalled()
  })

  it('hatalı satır yoksa hata raporu düğmesi YOK', async () => {
    cevap.onizleme = { body: { ok: true, data: { ...ONIZLEME, ozet: { ...ONIZLEME.ozet, hatali: 0 }, satirlar: ONIZLEME.satirlar.slice(0, 3) } } }
    render(<PersonelAtamaExcelPage />)
    dosyaSec()
    fireEvent.click(screen.getByRole('button', { name: /Önizle/ }))
    await screen.findByText(/Önizleme — \d+ satır/)
    expect(screen.queryByRole('button', { name: /Hata raporunu indir/ })).toBeNull()
  })

  it('boş durum: geçerli satır yok → uyarı, Uygula kapalı', async () => {
    cevap.onizleme = { body: { ok: true, data: { ...ONIZLEME, ozet: { toplamSatir: 1, yeni: 0, degisiklik: 0, dilimEkle: 0, degismeyen: 0, hatali: 1, kapasiteUyarisi: 0 }, satirlar: [ONIZLEME.satirlar[3]], etki: [] } } }
    render(<PersonelAtamaExcelPage />)
    dosyaSec()
    fireEvent.click(screen.getByRole('button', { name: /Önizle/ }))
    await screen.findByText(/Uygulanacak geçerli satır yok/)
    expect((screen.getByRole('button', { name: /0 satırı uygula/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('önizleme hatası (sunucu) Türkçe gösterilir; adım 1\'de kalınır', async () => {
    cevap.onizleme = { status: 400, body: { ok: false, message: 'Şablondaki sütun(lar) bulunamadı: Sicil No.' } }
    render(<PersonelAtamaExcelPage />)
    dosyaSec()
    fireEvent.click(screen.getByRole('button', { name: /Önizle/ }))
    expect(await screen.findByText(/sütun\(lar\) bulunamadı/)).toBeTruthy()
    expect(screen.queryByText(/Önizleme — \d+ satır/)).toBeNull()
  })
})

describe('3. Uygula', () => {
  it('normal: dosya + beklenen sayılar gönderilir; başarı özeti ve toplu işlem no', async () => {
    await onizleAc()
    fireEvent.click(screen.getByRole('button', { name: /3 satırı uygula/ }))
    await screen.findByText('3. Uygulandı')
    const c = cagrilar('/uygula')[0]
    expect(formDegeri(c, 'beklenenGecerli')).toBe('3')
    expect(formDegeri(c, 'beklenenHatali')).toBe('1')
    expect(formDegeri(c, 'asimOnayi')).toBe('false')
    expect((formDegeri(c, 'dosya') as File).name).toBe('atamalar.xlsx')
    expect(screen.getByTestId('uygulama-ozeti').textContent).toBe('1 yeni atama, 1 değişiklik, 1 dilim ekleme uygulandı; 1 hatalı satır atlandı.')
    expect(screen.getByText('toplu-123')).toBeTruthy()
    expect(screen.getByText(/tek tek kapatılabilir/)).toBeTruthy()
  })

  it('🔴 kapasite aşımı: kırmızı uyarı; onay kutusu işaretlenene kadar "Uygula" kapalı; onayla → asimOnayi=true', async () => {
    cevap.onizleme = { body: { ok: true, data: { ...ONIZLEME, asimVar: true, ozet: { ...ONIZLEME.ozet, kapasiteUyarisi: 1 }, etki: [etki({ once: 10, sonra: 11, asim: true, fazla: 1 })] } } }
    await onizleAc()
    expect(screen.getByText('Kapasite aşılacak')).toBeTruthy()
    expect(screen.getByTestId('kapasite-etkisi').textContent).toContain('AŞIM +1')
    const uygula = screen.getByRole('button', { name: /3 satırı uygula/ }) as HTMLButtonElement
    expect(uygula.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Aşımı biliyorum, devam et'))
    expect(uygula.disabled).toBe(false)
    fireEvent.click(uygula)
    await screen.findByText('3. Uygulandı')
    expect(formDegeri(cagrilar('/uygula')[0], 'asimOnayi')).toBe('true')
  })

  it('güvenli geri dönüş: sunucu "hiçbir satır uygulanmadı" derse mesaj gösterilir, önizleme açık kalır', async () => {
    cevap.uygula = { status: 400, body: { ok: false, message: 'Satır 3: Mevcut atama bu sırada değişti/kapandı. Hiçbir satır uygulanmadı.' } }
    await onizleAc()
    fireEvent.click(screen.getByRole('button', { name: /3 satırı uygula/ }))
    expect(await screen.findByText(/Hiçbir satır uygulanmadı/)).toBeTruthy()
    expect(screen.getByText(/Önizleme — 4 satır/)).toBeTruthy()
    expect(screen.queryByText('3. Uygulandı')).toBeNull()
  })

  it('sonradan değişiklik: önizleme eskidiyse (400) mesaj gösterilir; yeni dosya ile baştan başlanabilir', async () => {
    cevap.uygula = { status: 400, body: { ok: false, message: 'Önizlemeden sonra veriler değişti. Önizlemeyi yenileyip tekrar onaylayın.' } }
    await onizleAc()
    fireEvent.click(screen.getByRole('button', { name: /3 satırı uygula/ }))
    expect(await screen.findByText(/Önizlemeden sonra veriler değişti/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Vazgeç \/ Yeni dosya/ }))
    expect(screen.getByLabelText('Adımlar').textContent).toContain('1. Dosya yükle')
    expect((screen.getByRole('button', { name: /Önizle/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('409 aşım (önizlemeden sonra kapasite değişti): uyarı + onay kutusu çıkar, onaysız uygulanmaz', async () => {
    let n = 0
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('onizleme')) return { ok: true, status: 200, json: async () => ({ ok: true, data: ONIZLEME }) }
      n++
      return n === 1
        ? { ok: false, status: 409, json: async () => ({ ok: false, kod: 'ASIM_ONAYI_GEREKLI', message: 'aşım', ayrinti: { etki: [etki({ once: 10, sonra: 11, asim: true, fazla: 1 })] } }) }
        : { ok: true, status: 200, json: async () => ({ ok: true, data: SONUC }) }
    })
    await onizleAc()
    fireEvent.click(screen.getByRole('button', { name: /3 satırı uygula/ }))
    await screen.findByText('Kapasite aşılacak')
    const uygula = screen.getByRole('button', { name: /3 satırı uygula/ }) as HTMLButtonElement
    expect(uygula.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Aşımı biliyorum, devam et'))
    fireEvent.click(uygula)
    await screen.findByText('3. Uygulandı')
    expect(n).toBe(2)
  })

  it('ağ hatası: Türkçe mesaj, sessiz başarısızlık yok', async () => {
    await onizleAc()
    fetchMock.mockRejectedValue(new Error('ağ'))
    fireEvent.click(screen.getByRole('button', { name: /3 satırı uygula/ }))
    expect(await screen.findByText(/Sunucuya ulaşılamadı/)).toBeTruthy()
  })
})
