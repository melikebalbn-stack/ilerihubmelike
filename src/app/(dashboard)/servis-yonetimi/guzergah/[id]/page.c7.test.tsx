import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import GuzergahDetayPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

// C7-5 — Personel sekmesi: hesaplanan durum rozeti (Aktif / Başlamadı / Süresi doldu / Pasif) ve engeller.
const GUZERGAH = { id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, aktif: true, yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, gecerlilikBaslangici: null, gecerlilikBitisi: null }
const SABAH = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi', yon: 'GIDIS', aktif: true }
const atama = (id: string, ad: string, durum: string, o: { aktif?: boolean; dilimli?: boolean; bitis?: string | null; baslangic?: string } = {}) => ({
  id, personnelId: `p-${id}`, personnel: { id: `p-${id}`, adSoyad: ad, sicilNo: null, bolum: 'Üretim', aktif: true },
  durakId: null, durak: null, baslangicTarihi: o.baslangic ?? '2026-09-27', bitisTarihi: o.bitis ?? null, aktif: o.aktif ?? true, durum,
  dilimler: o.dilimli === false ? [] : [{ id: `l-${id}`, dilimId: 'd1', dilim: SABAH }],
})
const ATAMALAR = [
  atama('a1', 'Çağlar Şahin', 'AKTIF', { dilimli: false }),
  atama('a2', 'İlker Öztürk', 'BASLAMADI', { dilimli: false, baslangic: '2026-10-20' }),
  atama('a3', 'Şule Ğündoğdu', 'SURESI_DOLDU', { dilimli: false, bitis: '2026-10-02' }),
  atama('a4', 'Ayşe Yıldız', 'PASIF', { aktif: false, bitis: '2026-09-30' }),
  atama('a5', 'Öznur Çelik', 'AKTIF'),
]

const oturum = (p: string[]) => vi.mocked(useSession).mockReturnValue({ data: { user: { permissions: p } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)
let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    const u = String(url)
    const veri =
      u.endsWith('/guzergah/g1') ? GUZERGAH
      : u.includes('sefer-dilimi') ? [SABAH]
      : u.endsWith('/personel-atama') ? ATAMALAR
      : u.includes('kapasite-toplu') ? { guzergahlar: [] }
      : u.endsWith('/guzergah?durum=aktif') ? [GUZERGAH]
      : []
    return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  window.history.pushState({}, '', '/servis-yonetimi/guzergah/g1')
  oturum(['servis.view', 'servis.edit', 'servis.create', 'servis.passive'])
})
afterEach(() => vi.unstubAllGlobals())

async function ac() {
  render(<GuzergahDetayPage />)
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Personel Atamaları' }), { button: 0 })
  await screen.findByText('Çağlar Şahin')
}
const satir = (ad: string) => screen.getByText(ad).closest('tr') as HTMLElement

describe('C7-5 — durum rozetleri', () => {
  it('Aktif / Başlamadı / Süresi doldu / Pasif (aktif bayrağı değil hesaplanan durum)', async () => {
    await ac()
    expect(within(satir('Çağlar Şahin')).getByText('Aktif')).toBeTruthy()
    expect(within(satir('İlker Öztürk')).getByText('Başlamadı')).toBeTruthy()
    expect(within(satir('Şule Ğündoğdu')).getByText('Süresi doldu')).toBeTruthy()
    expect(within(satir('Ayşe Yıldız')).getByText('Pasif')).toBeTruthy()
  })

  it('eski yanıt (durum alanı yok) → aktif bayrağından türetilir (geriye dönük)', async () => {
    const eski = ATAMALAR.slice(0, 1).map(({ durum, ...gerisi }) => { void durum; return gerisi })
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url)
      const veri = u.endsWith('/guzergah/g1') ? GUZERGAH : u.includes('sefer-dilimi') ? [SABAH] : u.endsWith('/personel-atama') ? eski : u.includes('kapasite-toplu') ? { guzergahlar: [] } : []
      return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
    })
    await ac()
    expect(within(satir('Çağlar Şahin')).getByText('Aktif')).toBeTruthy()
  })
})

describe('C7-5 — "Süresi doldu" engelleri', () => {
  it('🔴 Dilim Düzenle, Alternatif Servis Öner ve Başka Güzergâha Taşı DEVRE DIŞI (ipucu: "Süresi dolmuş atama için bu işlem yapılamaz"); Kapat açık', async () => {
    await ac()
    const r = within(satir('Şule Ğündoğdu'))
    for (const ad of ['Dilim Düzenle', 'Alternatif Servis Öner', 'Başka Güzergâha Taşı']) {
      const b = r.getByRole('button', { name: ad }) as HTMLButtonElement
      expect(b.disabled).toBe(true)
      expect(b.title).toBe('Süresi dolmuş atama için bu işlem yapılamaz')
    }
    expect((r.getByRole('button', { name: 'Kapat' }) as HTMLButtonElement).disabled).toBe(false) // eski kaydı kapatmak serbest
  })

  it('"Başlamadı": Dilim Düzenle serbest ve açılır; Taşı düğmesi etkin (sunucu net mesajla reddeder)', async () => {
    await ac()
    const r = within(satir('İlker Öztürk'))
    expect((r.getByRole('button', { name: 'Dilim Düzenle' }) as HTMLButtonElement).disabled).toBe(false)
    expect((r.getByRole('button', { name: 'Başka Güzergâha Taşı' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(r.getByRole('button', { name: 'Dilim Düzenle' }))
    expect(await screen.findByText('Sefer Dilimlerini Düzenle — İlker Öztürk')).toBeTruthy()
  })

  it('"Başlamadı" atamada taşıma: sunucu mesajı diyalogta gösterilir', async () => {
    const eski = fetchMock.getMockImplementation() as (u: string, i?: RequestInit) => Promise<unknown>
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      String(url).includes('transfer-onizle')
        ? { ok: false, status: 400, json: async () => ({ ok: false, message: 'Bu atama henüz başlamamış (başlangıcı 2026-10-20); transfer edilemez.' }) }
        : eski(url, init))
    await ac()
    fireEvent.click(within(satir('İlker Öztürk')).getByRole('button', { name: 'Başka Güzergâha Taşı' }))
    await screen.findByText('Başka Güzergâha Taşı — İlker Öztürk')
    fireEvent.change(await screen.findByLabelText('Hedef güzergâh *'), { target: { value: 'g1' } })
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
    expect(await screen.findByText(/henüz başlamamış \(başlangıcı 2026-10-20\)/)).toBeTruthy()
  })
})

describe('C7-5 — seçim kutuları engelli satırları seçmez', () => {
  it('süresi dolmuş satırın kutusu devre dışı; pasif satırda kutu YOK', async () => {
    await ac()
    expect((within(satir('Şule Ğündoğdu')).getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
    expect(within(satir('Ayşe Yıldız')).queryByRole('checkbox')).toBeNull()
    expect((within(satir('Çağlar Şahin')).getByRole('checkbox') as HTMLInputElement).disabled).toBe(false)
  })

  it('🔴 "Tümünü seç": yalnız Aktif + Başlamadı (3 satır); süresi dolmuş ve pasif seçilmez', async () => {
    await ac()
    fireEvent.click(screen.getByLabelText('Tüm aktif atamaları seç'))
    expect(await screen.findByRole('button', { name: 'Dilim Ata (3)' })).toBeTruthy()
    expect((within(satir('Şule Ğündoğdu')).getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('🔴 "Dilimsiz atamaları seç": süresi dolmuş dilimsiz atama HARİÇ (2 satır: Aktif + Başlamadı); uyarı sayısı da 2', async () => {
    await ac()
    expect(screen.getByRole('button', { name: /Dilimsiz atamaları seç \(2\)/ })).toBeTruthy()
    expect(screen.getByTestId('dilimsiz-uyari').textContent).toContain('2 aktif atamanın sefer dilimi yok')
    fireEvent.click(screen.getByRole('button', { name: /Dilimsiz atamaları seç/ }))
    expect(await screen.findByRole('button', { name: 'Dilim Ata (2)' })).toBeTruthy()
    expect((within(satir('Şule Ğündoğdu')).getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('Veri Kalite bağlantısı (?dilimsiz=1) süresi dolmuş atamayı seçmez', async () => {
    window.history.pushState({}, '', '/servis-yonetimi/guzergah/g1?sekme=personel-atama&dilimsiz=1')
    render(<GuzergahDetayPage />)
    await screen.findByText('Çağlar Şahin')
    expect(await screen.findByRole('button', { name: 'Dilim Ata (2)' })).toBeTruthy()
  })
})
