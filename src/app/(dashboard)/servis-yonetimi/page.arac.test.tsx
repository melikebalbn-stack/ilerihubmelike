import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import ServisYonetimiPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

// Araç sekmesi — A6 (plaka) ve A7 (araç tipi, tarih kuralları) ekran davranışları.
const ARAC = {
  id: 'a1', plaka: '41P0145', kapasite: 15, firmaId: 'f1', firma: { id: 'f1', ad: 'Taşeron A', aktif: true },
  aracTipi: 'Minibüs', aktif: true, gecerlilikBaslangici: null, gecerlilikBitisi: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
}
const FIRMA = { id: 'f1', ad: 'Taşeron A', yetkiliAdi: null, telefon: null, eposta: null, adres: null, aktif: true }
const IDARI_ISLER = ['servis.view', 'servis.history', 'servis.tanim.manage']

function oturum(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({ data: { user: { permissions } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)
}

let fetchMock: ReturnType<typeof vi.fn>
function fetchKur(mutasyonlar: { ok: boolean; status: number; body: unknown }[] = [], araclar: unknown[] = [ARAC]) {
  const sira = [...mutasyonlar]
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PATCH') {
      const y = sira.shift() ?? { ok: true, status: 200, body: { ok: true, data: {} } }
      return { ok: y.ok, status: y.status, json: async () => y.body }
    }
    const veri = url.includes('/arac') ? araclar : url.includes('/firma') ? [FIRMA] : []
    return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
  })
  vi.stubGlobal('fetch', fetchMock)
}
const yazimlar = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST' || i?.method === 'PATCH')

async function aracSekmesi() {
  oturum(IDARI_ISLER)
  render(<ServisYonetimiPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Araçlar' }), { button: 0 })
  await waitFor(() => expect(screen.getByText('41P0145')).toBeTruthy())
}

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => fetchKur())

describe('Araç formu — A6 plaka', () => {
  it('plaka alanında biçim ipucu ve örnek gösterilir', async () => {
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    expect((screen.getByLabelText('Plaka *') as HTMLInputElement).placeholder).toBe('41P0145')
    expect(screen.getByText(/İl kodu \+ harf \+ rakam \(örn\. 41P0145\)\. Boşluk ve tire otomatik temizlenir\./)).toBeTruthy()
  })

  it('🔴 benzer plaka (409 BENZER_PLAKA): kayıt DURUR, uyarı + eşleşen plaka gösterilir; yalnız 1 POST', async () => {
    fetchKur([{
      ok: false, status: 409,
      body: { ok: false, kod: 'BENZER_PLAKA', message: 'Benzer plaka var: 41P0145 — aynı araç mı?', benzerler: [{ plaka: '41P0145', aktif: false }] },
    }])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '41PO145' } })
    fireEvent.change(screen.getByLabelText('Kapasite *'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    const uyari = await screen.findByText('Benzer plaka var: 41P0145 — aynı araç mı?')
    expect(uyari).toBeTruthy()
    expect(screen.getByText('41P0145 (pasif)')).toBeTruthy()
    expect(yazimlar()).toHaveLength(1)
    expect(JSON.parse(yazimlar()[0][1].body)).not.toHaveProperty('benzerPlakaOnayi')
    expect(screen.queryByRole('button', { name: 'Kaydet' })).toBeNull() // yerine onay düğmesi
  })

  it('🔴 "Aynı araç değil, yine de kaydet": benzerPlakaOnayi: true ile ikinci istek', async () => {
    fetchKur([
      { ok: false, status: 409, body: { ok: false, kod: 'BENZER_PLAKA', message: 'Benzer plaka var: 41P0145 — aynı araç mı?', benzerler: [{ plaka: '41P0145', aktif: true }] } },
      { ok: true, status: 201, body: { ok: true, data: {} } },
    ])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '41PO145' } })
    fireEvent.change(screen.getByLabelText('Kapasite *'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Aynı araç değil, yine de kaydet' }))

    await waitFor(() => expect(yazimlar()).toHaveLength(2))
    expect(JSON.parse(yazimlar()[1][1].body)).toMatchObject({ plaka: '41PO145', benzerPlakaOnayi: true })
    await waitFor(() => expect(screen.queryByText('Yeni Araç', { selector: 'h2' })).toBeNull())
  })

  it('plaka değiştirilince önceki benzer-plaka uyarısı ve onay düğmesi kalkar (onay yeni plakaya SIZMAZ)', async () => {
    fetchKur([{ ok: false, status: 409, body: { ok: false, kod: 'BENZER_PLAKA', message: 'Benzer plaka var: 41P0145 — aynı araç mı?', benzerler: [{ plaka: '41P0145', aktif: true }] } }])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '41PO145' } })
    fireEvent.change(screen.getByLabelText('Kapasite *'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await screen.findByRole('button', { name: 'Aynı araç değil, yine de kaydet' })

    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '06ABC123' } })
    expect(screen.queryByRole('button', { name: 'Aynı araç değil, yine de kaydet' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeTruthy()
  })

  it('biçim hatası (400) diyalog İÇİNDE, açık Türkçe mesajla gösterilir; onay düğmesi çıkmaz', async () => {
    const MESAJ = 'Geçersiz plaka biçimi: "99A123". Plaka il kodu (01-81), 1-3 harf ve 2-4 rakamdan oluşmalıdır (örn. 41P0145).'
    fetchKur([{ ok: false, status: 400, body: { ok: false, message: MESAJ } }])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '99A123' } })
    fireEvent.change(screen.getByLabelText('Kapasite *'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toBe(MESAJ))
    expect(screen.queryByRole('button', { name: 'Aynı araç değil, yine de kaydet' })).toBeNull()
  })

  it('pasif araçla aynı plaka: "Geri Al ile etkinleştirin" mesajı diyalogda', async () => {
    const MESAJ = '"41P0145" plakası pasif bir araç olarak kayıtlı. Yeni kayıt açmak yerine Geri Al ile etkinleştirin.'
    fetchKur([{ ok: false, status: 400, body: { ok: false, message: MESAJ } }])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '41 p 0145' } })
    fireEvent.change(screen.getByLabelText('Kapasite *'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain('Geri Al ile etkinleştirin'))
  })

  it('düzenlemede benzer plaka: PATCH uyarısı aynı akışla onaylanır', async () => {
    fetchKur([
      { ok: false, status: 409, body: { ok: false, kod: 'BENZER_PLAKA', message: 'Benzer plaka var: 06AB123 — aynı araç mı?', benzerler: [{ plaka: '06AB123', aktif: true }] } },
      { ok: true, status: 200, body: { ok: true, data: {} } },
    ])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '06A8123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Aynı araç değil, yine de kaydet' }))
    await waitFor(() => expect(yazimlar()).toHaveLength(2))
    expect(yazimlar()[1][0]).toBe('/api/servis-yonetimi/arac/a1')
    expect(yazimlar()[1][1].method).toBe('PATCH')
    expect(JSON.parse(yazimlar()[1][1].body)).toMatchObject({ plaka: '06A8123', benzerPlakaOnayi: true })
  })
})

describe('Araç formu — A7 araç tipi, tarih kuralları, ipucu', () => {
  it('🔴 Araç Tipi serbest metin DEĞİL seçim listesi: Seçin + Minibüs, Midibüs, Otobüs, Otomobil, Diğer', async () => {
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    const secim = screen.getByLabelText('Araç Tipi') as HTMLSelectElement
    expect(secim.tagName).toBe('SELECT')
    expect(within(secim).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Seçin', 'Minibüs', 'Midibüs', 'Otobüs', 'Otomobil', 'Diğer',
    ])
    expect(secim.value).toBe('')
  })

  it('seçilen araç tipi isteğe string olarak gider', async () => {
    fetchKur([{ ok: true, status: 201, body: { ok: true, data: {} } }])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '06ABC123' } })
    fireEvent.change(screen.getByLabelText('Kapasite *'), { target: { value: '27' } })
    fireEvent.change(screen.getByLabelText('Araç Tipi'), { target: { value: 'Otobüs' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(yazimlar()).toHaveLength(1))
    expect(JSON.parse(yazimlar()[0][1].body)).toMatchObject({ plaka: '06ABC123', kapasite: 27, aracTipi: 'Otobüs' })
  })

  it('🔴 eski serbest değer ("arapçeşme") düzenlemede BOZULMADAN gösterilir ve seçili gelir; kaydedince aynen gider', async () => {
    fetchKur([{ ok: true, status: 200, body: { ok: true, data: {} } }], [{ ...ARAC, aracTipi: 'arapçeşme' }])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    const secim = screen.getByLabelText('Araç Tipi') as HTMLSelectElement
    expect(secim.value).toBe('arapçeşme')
    expect(within(secim).getByRole('option', { name: 'arapçeşme (mevcut değer)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(yazimlar()).toHaveLength(1))
    expect(JSON.parse(yazimlar()[0][1].body).aracTipi).toBe('arapçeşme')
  })

  it('listedeki değer ("Minibüs") için "mevcut değer" seçeneği EKLENMEZ', async () => {
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    const secim = screen.getByLabelText('Araç Tipi') as HTMLSelectElement
    expect(secim.value).toBe('Minibüs')
    expect(within(secim).queryByRole('option', { name: /mevcut değer/ })).toBeNull()
  })

  it('araç tipi boş olan kayıt "Seçin" ile açılır', async () => {
    fetchKur([], [{ ...ARAC, aracTipi: null }])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    expect((screen.getByLabelText('Araç Tipi') as HTMLSelectElement).value).toBe('')
  })

  it('🔴 form ipucu: atama güzergâh detayındaki Varsayılan Araçlar bölümünden yapılır', async () => {
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    expect(screen.getByText('Aracın güzergâha atanması güzergâh detayındaki Varsayılan Araçlar bölümünden yapılır.')).toBeTruthy()
  })

  it('geçerlilik tarih alanlarına makul aralık (min 2020-01-01, max bugün+1 yıl) uygulanır; bitiş min = başlangıç', async () => {
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    const bas = screen.getByLabelText('Geçerlilik Başlangıcı') as HTMLInputElement
    const bit = screen.getByLabelText('Geçerlilik Bitişi') as HTMLInputElement
    expect(bas.min).toBe('2020-01-01')
    expect(bas.max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(bit.min).toBe('2020-01-01')
    fireEvent.change(bas, { target: { value: '2026-08-01' } })
    expect((screen.getByLabelText('Geçerlilik Bitişi') as HTMLInputElement).min).toBe('2026-08-01')
  })

  it('🔴 2099 bitişi sunucudan reddedilirse mesaj diyalog içinde görünür', async () => {
    const MESAJ = 'Geçerlilik bitiş tarihi bugünden en fazla 1 yıl sonrası (2027-10-03) olabilir.'
    fetchKur([{ ok: false, status: 400, body: { ok: false, message: MESAJ } }])
    await aracSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Araç/ }))
    fireEvent.change(screen.getByLabelText('Plaka *'), { target: { value: '06ABC123' } })
    fireEvent.change(screen.getByLabelText('Kapasite *'), { target: { value: '27' } })
    fireEvent.change(screen.getByLabelText('Geçerlilik Bitişi'), { target: { value: '2099-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(MESAJ))
  })
})
