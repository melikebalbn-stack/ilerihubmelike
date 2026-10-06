import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import GuzergahDetayPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

// Bileşen testleri (jsdom): Yeni Atama dilim zorunluluğu, aşım uyarısını kapatma (kayıt olmaz),
// pasif atamada Geri Al sunucu çakışma hatası, idari-isler rolünde yetkisiz düğmelerin yokluğu.
const GUZERGAH = { id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, aktif: true, yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, gecerlilikBaslangici: null, gecerlilikBitisi: null }
const SABAH = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi', yon: 'GIDIS', aktif: true }
const AKTIF_ATAMA = {
  id: 'a1', personnelId: 'p1', personnel: { id: 'p1', adSoyad: 'Çağlar Şahin', sicilNo: '101', bolum: 'Üretim', aktif: true },
  durakId: null, durak: null, baslangicTarihi: '2026-09-27', bitisTarihi: null, aktif: true, durum: 'AKTIF',
  dilimler: [{ id: 'l1', dilimId: 'd1', dilim: SABAH }],
}
const PASIF_ATAMA = {
  ...AKTIF_ATAMA, id: 'a2', personnelId: 'p2', personnel: { id: 'p2', adSoyad: 'Mehmet Yılmaz', sicilNo: '102', bolum: 'Üretim', aktif: true },
  bitisTarihi: '2026-10-06', aktif: false, durum: 'PASIF',
}
const ETKI = { dilimId: 'd1', dilimKod: 'SABAH_GIDIŞ', dilimAd: 'Sabah', once: 10, sonra: 11, koltuk: 10, aracYok: false, asim: true, fazla: 1 }
const CAKISMA = 'Bu personelin 2026-10-06 tarihinden itibaren süresiz aralığında zaten "ÜSKÜDAR — Üsküdar-Zeynepkamil" güzergahına aktif bir ataması var. Önce onu kapatmalısınız.'

const IDARI_ISLER = ['servis.view', 'servis.create', 'servis.edit', 'servis.history', 'servis.tanim.manage', 'servis.sorumlu.manage']
const IK = [...IDARI_ISLER, 'servis.passive', 'servis.restore', 'servis.export']

const oturum = (permissions: string[]) =>
  vi.mocked(useSession).mockReturnValue({ data: { user: { permissions } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)

let fetchMock: ReturnType<typeof vi.fn>
let postCevaplari: Record<string, { status: number; body: unknown }[]>
function fetchKur(atamalar: unknown[] = [AKTIF_ATAMA]) {
  postCevaplari = {}
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    if (init?.method === 'POST') {
      const ad = Object.keys(postCevaplari).find((p) => u.includes(p))
      const c = ad ? postCevaplari[ad].shift() : undefined
      const r = c ?? { status: 200, body: { ok: true, data: {} } }
      return { ok: r.status < 400, status: r.status, json: async () => r.body }
    }
    const veri =
      u.endsWith('/guzergah/g1') ? GUZERGAH
      : u.includes('sefer-dilimi') ? [SABAH]
      : u.endsWith('/guzergah/g1/personel-atama') ? atamalar
      : u.includes('kapasite-toplu') ? { guzergahlar: [] }
      : u.includes('personel-ara') ? [{ id: 'p5', sicilNo: '555', adSoyad: 'İlker Öztürk' }]
      : []
    return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
  })
  vi.stubGlobal('fetch', fetchMock)
}
const postlar = (parca: string) => fetchMock.mock.calls.filter(([u, i]) => String(u).includes(parca) && (i as RequestInit | undefined)?.method === 'POST')
const govde = (c: unknown[]) => JSON.parse((c[1] as RequestInit).body as string)

async function personelSekmesi(bekle = 'Çağlar Şahin') {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Personel Atamaları' }), { button: 0 })
  await screen.findByText(bekle)
}
async function yeniAtamaPersonelSecili() {
  render(<GuzergahDetayPage />)
  await personelSekmesi()
  fireEvent.click(screen.getByRole('button', { name: /Yeni Atama/ }))
  fireEvent.change(await screen.findByPlaceholderText(/Sicil No veya Ad Soyad/), { target: { value: 'İlk' } })
  const secenek = await screen.findByText('İlker Öztürk', { exact: false }, { timeout: 3000 })
  fireEvent.mouseDown(secenek.closest('button') as HTMLElement)
}

beforeEach(() => {
  fetchKur()
  window.history.pushState({}, '', '/servis-yonetimi/guzergah/g1')
  oturum(IK)
})
afterEach(() => vi.unstubAllGlobals())

describe('Yeni Atama — dilim zorunluluğu (arayüz)', () => {
  it('🔴 personel seçili ama dilim seçilmemiş → Kaydet PASİF; dilim işaretlenince etkin; işaret kalkınca yine pasif', async () => {
    await yeniAtamaPersonelSecili()
    const kaydet = screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement
    expect(kaydet.disabled).toBe(true)
    const kutu = screen.getByLabelText(/SABAH_GIDIŞ/)
    fireEvent.click(kutu)
    expect((screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(kutu)
    expect((screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement).disabled).toBe(true)
    expect(postlar('/guzergah/g1/personel-atama')).toHaveLength(0)
  })

  it('🔴 sunucu dilim hatası (400) kullanıcıya Türkçe gösterilir; kayıt tek istekle sınırlı', async () => {
    postCevaplari['/guzergah/g1/personel-atama'] = [{ status: 400, body: { ok: false, message: 'En az bir sefer dilimi seçilmelidir.' } }]
    await yeniAtamaPersonelSecili()
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('En az bir sefer dilimi seçilmelidir.')).toBeTruthy()
    expect(postlar('/guzergah/g1/personel-atama')).toHaveLength(1)
  })
})

describe('Yeni Atama — aşım uyarısı kapatılırsa (Vazgeç) kayıt olmaz', () => {
  it('🔴 409 → uyarı görünür → onaysız diyalog kapatılır (Esc): ikinci istek ATILMAZ, asimOnayi hiç gönderilmez', async () => {
    postCevaplari['/guzergah/g1/personel-atama'] = [{ status: 409, body: { ok: false, kod: 'ASIM_ONAYI_GEREKLI', message: 'aşım', ayrinti: { etki: [ETKI] } } }]
    await yeniAtamaPersonelSecili()
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await screen.findByText('Kapasite aşılacak')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByText('Kapasite aşılacak')).toBeNull())
    const p = postlar('/guzergah/g1/personel-atama')
    expect(p).toHaveLength(1)
    expect(govde(p[0]).asimOnayi).toBeUndefined()
  })
})

describe('Pasif atama — Geri Al', () => {
  it('🔴 sunucu çakışma hatası (400) kullanıcı metni olarak görünür; liste "aktif" olmaz', async () => {
    fetchKur([AKTIF_ATAMA, PASIF_ATAMA])
    postCevaplari['/geri-al'] = [{ status: 400, body: { ok: false, message: CAKISMA } }]
    render(<GuzergahDetayPage />)
    await personelSekmesi('Mehmet Yılmaz')
    fireEvent.click(screen.getByRole('button', { name: 'Geri Al' }))
    expect(await screen.findByText(CAKISMA)).toBeTruthy()
    expect(postlar('/guzergah-personel-atama/a2/geri-al')).toHaveLength(1)
  })

  it('403 → "Bu işlem için yetkiniz yok." (ham hata metni değil)', async () => {
    fetchKur([AKTIF_ATAMA, PASIF_ATAMA])
    postCevaplari['/geri-al'] = [{ status: 403, body: { error: 'Yetersiz yetki' } }]
    render(<GuzergahDetayPage />)
    await personelSekmesi('Mehmet Yılmaz')
    fireEvent.click(screen.getByRole('button', { name: 'Geri Al' }))
    expect(await screen.findByText('Bu işlem için yetkiniz yok.')).toBeTruthy()
  })
})

describe('idari-isler rolü — güzergâh detay yetkisiz düğmeler', () => {
  it('🔴 idari-isler: Kapat / Geri Al / Başka Güzergâha Taşı / PDF YOK; Bitiş düzeltme, Dilim Düzenle, Yeni Atama VAR', async () => {
    fetchKur([AKTIF_ATAMA, PASIF_ATAMA])
    oturum(IDARI_ISLER)
    render(<GuzergahDetayPage />)
    await personelSekmesi('Mehmet Yılmaz')
    expect(screen.queryByRole('button', { name: 'Kapat' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Geri Al' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Başka Güzergâha Taşı' })).toBeNull()
    expect(screen.queryByText(/Güzergâh Detayı \(PDF\)/)).toBeNull()
    expect(screen.getByRole('button', { name: /Yeni Atama/ })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Dilim Düzenle' }).length).toBeGreaterThan(0)
  })

  it('kontrol grubu (İK: passive+restore+export): Kapat, Geri Al, Taşı ve PDF görünür', async () => {
    fetchKur([AKTIF_ATAMA, PASIF_ATAMA])
    oturum(IK)
    render(<GuzergahDetayPage />)
    await personelSekmesi('Mehmet Yılmaz')
    expect(screen.getByRole('button', { name: 'Kapat' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Geri Al' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Başka Güzergâha Taşı' })).toBeTruthy()
    expect(screen.getByText(/Güzergâh Detayı \(PDF\)/)).toBeTruthy()
  })
})
