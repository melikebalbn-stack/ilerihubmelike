import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import GuzergahDetayPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

// A3 — atama kayıtlarının düzenleme diyalogları (araç/şoför varsayılan, sorumlu,
// personel ataması): başlangıç/bitiş düzeltme, yetki katmanı, hata gösterimi.

const DILIM = { id: 'd1', kod: 'SABAH_GIDIS', ad: 'Sabah Servisi', yon: 'GIDIS' }
const GUZERGAH = {
  id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, aktif: true,
  yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, gecerlilikBaslangici: null, gecerlilikBitisi: null,
}
const ORTAK = {
  rol: 'ANA', baslangicTarihi: '2026-01-01T00:00:00.000Z', aktif: true, neden: 'ilk kayıt', aciklama: null,
}
const ARAC_V = [{ id: 'av1', dilimId: 'd1', dilim: DILIM, aracId: 'a1', arac: { id: 'a1', plaka: '41P0145', aktif: true }, bitisTarihi: '2026-06-30T00:00:00.000Z', ...ORTAK }]
const SOFOR_V = [{ id: 'sv1', dilimId: 'd1', dilim: DILIM, soforId: 's1', sofor: { id: 's1', adSoyad: 'Mehmet Şoför', aktif: true }, bitisTarihi: null, ...ORTAK }]
const SORUMLU = [{ id: 'sr1', personnelId: 'p1', personnel: { id: 'p1', adSoyad: 'Ayşe Sorumlu', sicilNo: '9', aktif: true }, bitisTarihi: null, ...ORTAK }]
const ATAMA = [{
  id: 'pa1', personnelId: 'p2', personnel: { id: 'p2', adSoyad: 'Ahmet Yolcu', sicilNo: '1', bolum: 'Üretim', aktif: true },
  durakId: 'dr1', durak: { id: 'dr1', kod: 'DARICA-01', ad: 'Cumhuriyet Meydanı' },
  baslangicTarihi: '2026-01-01T00:00:00.000Z', bitisTarihi: null, aktif: true, dilimler: [{ id: 'x', dilimId: 'd1', dilim: DILIM }],
}]

const IDARI_ISLER = ['servis.view', 'servis.create', 'servis.edit', 'servis.history', 'servis.tanim.manage', 'servis.sorumlu.manage']

function oturum(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } }, status: 'authenticated',
  } as unknown as ReturnType<typeof useSession>)
}

let fetchMock: ReturnType<typeof vi.fn>
function fetchKur(patchYaniti?: { ok: boolean; status: number; body: unknown }) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const y = patchYaniti ?? { ok: true, status: 200, body: { ok: true, data: {} } }
      return { ok: y.ok, status: y.status, json: async () => y.body }
    }
    const veri =
      url.endsWith('/guzergah/g1') ? GUZERGAH
      : url.includes('/arac-varsayilan') ? ARAC_V
      : url.includes('/sofor-varsayilan') ? SOFOR_V
      : url.includes('/guzergah/g1/sorumlu') ? SORUMLU
      : url.includes('/personel-atama') ? ATAMA
      : url.includes('/sefer-dilimi') ? [DILIM]
      : []
    return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
  })
  vi.stubGlobal('fetch', fetchMock)
}
const patchler = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'PATCH')

async function sekmeAc(ad: string, bekle: RegExp) {
  render(<GuzergahDetayPage />)
  await waitFor(() => expect(screen.getByRole('tab', { name: ad })).toBeTruthy())
  fireEvent.mouseDown(screen.getByRole('tab', { name: ad }), { button: 0 })
  await waitFor(() => expect(screen.getByText(bekle)).toBeTruthy())
}

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => {
  fetchKur()
  oturum(IDARI_ISLER)
})

describe('A3 — varsayılan araç ataması düzenleme', () => {
  it('Düzenle: mevcut başlangıç/bitiş/neden dolu açılır', async () => {
    await sekmeAc('Varsayılan Araçlar', /41P0145/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    expect((screen.getByLabelText('Başlangıç *') as HTMLInputElement).value).toBe('2026-01-01')
    expect((screen.getByLabelText('Bitiş') as HTMLInputElement).value).toBe('2026-06-30')
    expect((screen.getByLabelText('Neden') as HTMLInputElement).value).toBe('ilk kayıt')
    expect(screen.getByText(/SABAH_GIDIS — 41P0145 \(ANA\)/)).toBeTruthy()
  })

  it('başlangıç ve bitiş düzeltilip kaydedilince PATCH doğru uca ve gövdeyle gider', async () => {
    await sekmeAc('Varsayılan Araçlar', /41P0145/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    fireEvent.change(screen.getByLabelText('Başlangıç *'), { target: { value: '2026-02-01' } })
    fireEvent.change(screen.getByLabelText('Bitiş'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(patchler()).toHaveLength(1))
    const [url, init] = patchler()[0]
    expect(url).toBe('/api/servis-yonetimi/guzergah-arac-varsayilan/av1')
    expect(JSON.parse(init.body)).toEqual({
      baslangicTarihi: '2026-02-01', bitisTarihi: '2026-12-31', neden: 'ilk kayıt', aciklama: '',
    })
    // başarıda diyalog kapanır
    await waitFor(() => expect(screen.queryByText('Varsayılan Araç Ataması — Düzenle')).toBeNull())
  })

  it('bitiş boşaltılınca süresiz: gövdede bitisTarihi boş string', async () => {
    await sekmeAc('Varsayılan Araçlar', /41P0145/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    fireEvent.change(screen.getByLabelText('Bitiş'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(patchler()).toHaveLength(1))
    expect(JSON.parse(patchler()[0][1].body).bitisTarihi).toBe('')
  })

  it('🔴 sunucu tarih hatası DİYALOG İÇİNDE gösterilir ve diyalog açık kalır', async () => {
    fetchKur({ ok: false, status: 400, body: { ok: false, message: 'Bitiş tarihi başlangıç tarihinden önce olamaz.' } })
    await sekmeAc('Varsayılan Araçlar', /41P0145/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    const uyari = await screen.findByRole('alert')
    expect(uyari.textContent).toBe('Bitiş tarihi başlangıç tarihinden önce olamaz.')
    expect(screen.getByText('Varsayılan Araç Ataması — Düzenle')).toBeTruthy()
  })

  it('🔴 403: "Bu işlem için yetkiniz yok." diyalog içinde', async () => {
    fetchKur({ ok: false, status: 403, body: { error: 'Yetersiz yetki' } })
    await sekmeAc('Varsayılan Araçlar', /41P0145/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Bu işlem için yetkiniz yok.')
  })

  it('tarih alanlarına makul aralık (min/max) uygulanır', async () => {
    await sekmeAc('Varsayılan Araçlar', /41P0145/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    const baslangic = screen.getByLabelText('Başlangıç *') as HTMLInputElement
    expect(baslangic.min).toBe('2020-01-01')
    expect(baslangic.max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((screen.getByLabelText('Bitiş') as HTMLInputElement).min).toBe('2026-01-01')
  })

  it('🔴 yetki: servis.tanim.manage yoksa Düzenle görünmez', async () => {
    oturum(['servis.view', 'servis.history'])
    await sekmeAc('Varsayılan Araçlar', /41P0145/)
    expect(screen.queryByRole('button', { name: 'Düzenle' })).toBeNull()
  })
})

describe('A3 — varsayılan şoför ataması düzenleme', () => {
  it('Düzenle → PATCH guzergah-sofor-varsayilan; başlangıç + bitiş gönderilir', async () => {
    await sekmeAc('Varsayılan Şoförler', /Mehmet Şoför/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    fireEvent.change(screen.getByLabelText('Bitiş'), { target: { value: '2026-11-30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(patchler()).toHaveLength(1))
    expect(patchler()[0][0]).toBe('/api/servis-yonetimi/guzergah-sofor-varsayilan/sv1')
    expect(JSON.parse(patchler()[0][1].body)).toMatchObject({ baslangicTarihi: '2026-01-01', bitisTarihi: '2026-11-30' })
  })

  it('🔴 yetki: servis.tanim.manage yoksa Düzenle görünmez', async () => {
    oturum(['servis.view'])
    await sekmeAc('Varsayılan Şoförler', /Mehmet Şoför/)
    expect(screen.queryByRole('button', { name: 'Düzenle' })).toBeNull()
  })
})

describe('A3 — servis sorumlusu düzenleme', () => {
  it('Düzenle → PATCH guzergah-sorumlu; kimlik (personel) alanı gövdede YOK', async () => {
    await sekmeAc('Servis Sorumluları', /Ayşe Sorumlu/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    fireEvent.change(screen.getByLabelText('Neden'), { target: { value: 'Görev değişikliği' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(patchler()).toHaveLength(1))
    expect(patchler()[0][0]).toBe('/api/servis-yonetimi/guzergah-sorumlu/sr1')
    const govde = JSON.parse(patchler()[0][1].body)
    expect(govde.neden).toBe('Görev değişikliği')
    expect(govde).not.toHaveProperty('personnelId')
  })

  it('🔴 yetki: yalnız servis.tanim.manage (sorumlu.manage YOK) → Düzenle görünmez', async () => {
    oturum(['servis.view', 'servis.tanim.manage'])
    await sekmeAc('Servis Sorumluları', /Ayşe Sorumlu/)
    expect(screen.queryByRole('button', { name: 'Düzenle' })).toBeNull()
  })
})

describe('A3 — personel ataması bitiş tarihi düzeltme', () => {
  it('"Bitiş Tarihini Düzelt": başlangıç salt okunur, gövde yalnız bitisTarihi', async () => {
    await sekmeAc('Personel Atamaları', /Ahmet Yolcu/)
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    const baslangic = screen.getByLabelText('Başlangıç') as HTMLInputElement
    expect(baslangic.disabled).toBe(true)
    expect(screen.queryByLabelText('Neden')).toBeNull()
    fireEvent.change(screen.getByLabelText('Bitiş'), { target: { value: '2026-09-30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(patchler()).toHaveLength(1))
    expect(patchler()[0][0]).toBe('/api/servis-yonetimi/guzergah-personel-atama/pa1')
    expect(JSON.parse(patchler()[0][1].body)).toEqual({ bitisTarihi: '2026-09-30' })
  })

  it('🔴 yetki: servis.create var ama servis.edit YOK → Düzenle görünmez', async () => {
    oturum(['servis.view', 'servis.create', 'servis.tanim.manage'])
    await sekmeAc('Personel Atamaları', /Ahmet Yolcu/)
    expect(screen.queryByRole('button', { name: 'Düzenle' })).toBeNull()
  })

  it('düzenleme yetkisi yokken satırda hiçbir eylem sütunu çıkmaz (yalnız görüntüleme)', async () => {
    oturum(['servis.view'])
    await sekmeAc('Personel Atamaları', /Ahmet Yolcu/)
    const tablo = screen.getByRole('table')
    expect(within(tablo).queryByRole('columnheader', { name: 'İşlem' })).toBeNull()
  })
})
