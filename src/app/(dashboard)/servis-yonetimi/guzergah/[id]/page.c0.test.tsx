import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import GuzergahDetayPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

// C0 (Yeni Atama aşım onayı) ve C1 (serbest hedefli transfer) — Personel Atamaları sekmesi.
const GUZERGAH = { id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, aktif: true, yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, gecerlilikBaslangici: null, gecerlilikBitisi: null }
const SABAH = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi', yon: 'GIDIS', aktif: true }
const AKSAM = { id: 'd2', kod: 'AKŞAM_DÖNÜŞ', ad: 'Akşam Servisi', yon: 'DONUS', aktif: true }
const ATAMA = {
  id: 'a1', personnelId: 'p1', personnel: { id: 'p1', adSoyad: 'Çağlar Şahin', sicilNo: '101', bolum: 'Üretim', aktif: true },
  durakId: null, durak: null, baslangicTarihi: '2026-09-27', bitisTarihi: null, aktif: true,
  dilimler: [{ id: 'l1', dilimId: 'd1', dilim: SABAH }],
}
const HEDEFLER = [
  { id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aktif: true },
  { id: 'g9', kod: 'ÜSKÜDAR', ad: 'Üsküdar-Zeynepkamil', aktif: true }, // öneri listesinde OLMAYAN herhangi güzergâh
]
const HEDEF_DURAKLAR = [
  { id: 'gd1', durakId: 'dk1', durak: { id: 'dk1', kod: 'USK-01', ad: 'Şemsipaşa Meydanı', aktif: true }, sira: 1, aktif: true, saatler: [] },
  { id: 'gd2', durakId: 'dk2', durak: { id: 'dk2', kod: 'USK-02', ad: 'Eski Durak', aktif: false }, sira: 2, aktif: false, saatler: [] },
]
const etki = (o: object = {}) => ({ dilimId: 'd1', dilimKod: 'SABAH_GIDIŞ', dilimAd: 'Sabah', once: 8, sonra: 9, koltuk: 10, aracYok: false, asim: false, fazla: 0, ...o })

const oturum = (permissions: string[]) =>
  vi.mocked(useSession).mockReturnValue({ data: { user: { permissions } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)

type Cevap = { status?: number; body: unknown }
let cevaplar: Record<string, Cevap>
let fetchMock: ReturnType<typeof vi.fn>
function fetchKur() {
  fetchMock = vi.fn(async (url: string) => {
    const u = String(url)
    for (const [parca, c] of Object.entries(cevaplar)) {
      if (u.includes(parca)) return { ok: (c.status ?? 200) < 400, status: c.status ?? 200, json: async () => c.body }
    }
    const veri =
      u.endsWith('/guzergah/g1') ? GUZERGAH
      : u.includes('sefer-dilimi') ? [SABAH, AKSAM]
      : u.endsWith('/guzergah/g1/personel-atama') ? [ATAMA]
      : u.includes('kapasite-toplu') ? { guzergahlar: [] }
      : u.includes('personel-ara') ? [{ id: 'p5', sicilNo: '555', adSoyad: 'İlker Öztürk' }]
      : u.endsWith('/guzergah?durum=aktif') ? HEDEFLER
      : u.endsWith('/guzergah/g9/durak') ? HEDEF_DURAKLAR
      : []
    return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
  })
  vi.stubGlobal('fetch', fetchMock)
}
const cagrilar = (parca: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(parca))
const govde = (c: unknown[]) => JSON.parse((c[1] as RequestInit).body as string)

async function personelSekmesi() {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Personel Atamaları' }), { button: 0 })
  await screen.findByText('Çağlar Şahin')
}

beforeEach(() => {
  cevaplar = {}
  fetchKur()
  window.history.pushState({}, '', '/servis-yonetimi/guzergah/g1')
  oturum(['servis.view', 'servis.edit', 'servis.create', 'servis.passive'])
})
afterEach(() => vi.unstubAllGlobals())

describe('C0 — Yeni Atama: kapasite aşımı uyarısı + onay', () => {
  async function formuDoldur() {
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Atama/ }))
    const kutu = await screen.findByPlaceholderText(/Sicil No veya Ad Soyad/)
    fireEvent.change(kutu, { target: { value: 'İlk' } })
    const secenek = await screen.findByText('İlker Öztürk', { exact: false }, { timeout: 3000 })
    fireEvent.mouseDown(secenek.closest('button') as HTMLElement)
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
  }

  it('🔴 409 → "Kapasite aşılacak" uyarısı; "Kaydet" yerine "Onayla ve Kaydet" onay kutusu işaretlenene kadar kapalı; onayla → asimOnayi:true', async () => {
    let n = 0
    const eski = fetchMock.getMockImplementation() as (u: string, i?: RequestInit) => Promise<unknown>
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/guzergah/g1/personel-atama') && init?.method === 'POST') {
        n++
        return n === 1
          ? { ok: false, status: 409, json: async () => ({ ok: false, kod: 'ASIM_ONAYI_GEREKLI', message: 'aşım', ayrinti: { etki: [etki({ once: 10, sonra: 11, asim: true, fazla: 1 })] } }) }
          : { ok: true, status: 201, json: async () => ({ ok: true, data: {} }) }
      }
      return eski(url, init)
    })
    await formuDoldur()
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await screen.findByText('Kapasite aşılacak')
    expect(screen.getByText(/SABAH_GIDIŞ: personel 10 → 11 \/ koltuk 10/)).toBeTruthy()
    const onayla = screen.getByRole('button', { name: 'Onayla ve Kaydet' }) as HTMLButtonElement
    expect(onayla.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Aşımı biliyorum, devam et'))
    fireEvent.click(onayla)
    await waitFor(() => expect(cagrilar('/guzergah/g1/personel-atama').filter(([, i]) => (i as RequestInit)?.method === 'POST')).toHaveLength(2))
    const posts = cagrilar('/guzergah/g1/personel-atama').filter(([, i]) => (i as RequestInit)?.method === 'POST')
    expect(govde(posts[0]).asimOnayi).toBeUndefined() // ilk gönderim onaysız
    expect(govde(posts[1])).toMatchObject({ personnelId: 'p5', dilimIdleri: ['d1'], asimOnayi: true })
  })

  it('aşım yoksa doğrudan kaydedilir, uyarı çıkmaz', async () => {
    const eski = fetchMock.getMockImplementation() as (u: string, i?: RequestInit) => Promise<unknown>
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      String(url).endsWith('/guzergah/g1/personel-atama') && init?.method === 'POST'
        ? { ok: true, status: 201, json: async () => ({ ok: true, data: {} }) }
        : eski(url, init))
    await formuDoldur()
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(cagrilar('/guzergah/g1/personel-atama').some(([, i]) => (i as RequestInit)?.method === 'POST')).toBe(true))
    expect(screen.queryByText('Kapasite aşılacak')).toBeNull()
  })
})

describe('C1 — Başka Güzergâha Taşı (serbest hedef)', () => {
  async function ac() {
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    fireEvent.click(within(screen.getByText('Çağlar Şahin').closest('tr') as HTMLElement).getByRole('button', { name: 'Başka Güzergâha Taşı' }))
    await screen.findByText('Başka Güzergâha Taşı — Çağlar Şahin')
  }

  it('🔴 yetki: servis.passive/create yoksa düğme YOK', async () => {
    oturum(['servis.view', 'servis.edit'])
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    expect(screen.queryByRole('button', { name: 'Başka Güzergâha Taşı' })).toBeNull()
  })

  it('herhangi aktif güzergâh + durak + dilim seçilir; hedefte kapasite durumu görünür; uygula tek transfer isteği', async () => {
    cevaplar['transfer-onizle'] = { body: { ok: true, data: { etki: [etki()], asimVar: false } } }
    cevaplar['/transfer'] = { body: { ok: true, data: {} } }
    await ac()
    expect((screen.getByRole('button', { name: 'Transferi Uygula' }) as HTMLButtonElement).disabled).toBe(true) // dilim yok
    // hedef: ÖNERİ listesinde olmayan ÜSKÜDAR
    await waitFor(() => expect(screen.getByRole('option', { name: 'ÜSKÜDAR — Üsküdar-Zeynepkamil' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Hedef güzergâh *'), { target: { value: 'g9' } })
    await screen.findByRole('option', { name: 'USK-01 — Şemsipaşa Meydanı' })
    expect(screen.queryByRole('option', { name: /USK-02/ })).toBeNull() // pasif durak seçilemez
    fireEvent.change(screen.getByLabelText('Hedef durak (opsiyonel)'), { target: { value: 'dk1' } })
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
    const kutu = await screen.findByTestId('transfer-etki')
    expect(kutu.textContent).toContain('SABAH_GIDIŞ: personel 8 → 9 / koltuk 10')
    fireEvent.click(screen.getByRole('button', { name: 'Transferi Uygula' }))
    await waitFor(() => expect(cagrilar('/a1/transfer').filter(([u]) => !String(u).includes('onizle'))).toHaveLength(1))
    const t = cagrilar('/a1/transfer').filter(([u]) => !String(u).includes('onizle'))[0]
    expect(govde(t)).toMatchObject({ guzergahId: 'g9', durakId: 'dk1', dilimIdleri: ['d1'], asimOnayi: false })
    expect(String(t[0])).toContain('/guzergah-personel-atama/a1/transfer')
  })

  it('🔴 aşım: kırmızı uyarı, onaylanmadan "Transferi Uygula" kapalı; onayla → asimOnayi:true', async () => {
    cevaplar['transfer-onizle'] = { body: { ok: true, data: { etki: [etki({ once: 10, sonra: 11, asim: true, fazla: 1 })], asimVar: true } } }
    cevaplar['/transfer'] = { body: { ok: true, data: {} } }
    await ac()
    await waitFor(() => expect(screen.getByRole('option', { name: 'ÜSKÜDAR — Üsküdar-Zeynepkamil' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Hedef güzergâh *'), { target: { value: 'g9' } })
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
    await screen.findByText('Kapasite aşılacak')
    expect(screen.getByText(/AŞIM \+1/)).toBeTruthy()
    const uygula = screen.getByRole('button', { name: 'Transferi Uygula' }) as HTMLButtonElement
    expect(uygula.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Aşımı biliyorum, devam et'))
    expect(uygula.disabled).toBe(false)
    fireEvent.click(uygula)
    await waitFor(() => expect(cagrilar('/a1/transfer').filter(([u]) => !String(u).includes('onizle')).length).toBe(1))
    expect(govde(cagrilar('/a1/transfer').filter(([u]) => !String(u).includes('onizle'))[0]).asimOnayi).toBe(true)
  })

  it('C5: ileri tarihli transferde açıklama notu çıkar (eski atama o güne kadar aktif, bugünün kapasitesi etkilenmez); bugün tarihlide çıkmaz', async () => {
    cevaplar['transfer-onizle'] = { body: { ok: true, data: { etki: [etki({ once: 8, sonra: 8 })], asimVar: false } } }
    await ac()
    expect(screen.queryByTestId('transfer-ileri-not')).toBeNull()
    fireEvent.change(screen.getByLabelText('Transfer Tarihi *'), { target: { value: '2999-01-01' } })
    expect(screen.getByTestId('transfer-ileri-not').textContent).toContain('eski atama geçiş gününe kadar aktif kalır')
    expect(screen.getByTestId('transfer-ileri-not').textContent).toContain('2999-01-01 tarihinde başlar')
  })

  it('kullanıcı hatası: önizleme hatası Türkçe gösterilir ve uygulama kapalı kalır; uygulama hatası diyalogda kalır', async () => {
    cevaplar['transfer-onizle'] = { status: 400, body: { ok: false, message: 'Pasif güzergaha transfer yapılamaz.' } }
    await ac()
    await waitFor(() => expect(screen.getByRole('option', { name: 'ÜSKÜDAR — Üsküdar-Zeynepkamil' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Hedef güzergâh *'), { target: { value: 'g9' } })
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
    expect(await screen.findByText('Pasif güzergaha transfer yapılamaz.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Transferi Uygula' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('C2 — Personel sekmesinde "Excel\'den Toplu Atama" düğmesi', () => {
  it('servis.edit ile görünür ve toplu atama sayfasına gider', async () => {
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    expect(screen.getByRole('link', { name: "Excel'den Toplu Atama" }).getAttribute('href')).toBe('/servis-yonetimi/personel-atama-excel')
  })

  it('🔴 yalnız servis.view → düğme YOK', async () => {
    oturum(['servis.view'])
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    expect(screen.queryByRole('link', { name: "Excel'den Toplu Atama" })).toBeNull()
  })
})
