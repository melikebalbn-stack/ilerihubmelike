import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import GuzergahDetayPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

// C7-10 — üst kapasite kartları: kapasiteyi etkileyen BAŞARILI yazmadan sonra yeniden çekilir; başarısızda çekilmez.
const GUZERGAH = {
  id: 'g1', kod: 'ARAPCESME', ad: 'Arapçeşme', aciklama: null, bolge: null, aktif: true,
  yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, gecerlilikBaslangici: null, gecerlilikBitisi: null,
}
const SABAH = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi', yon: 'GIDIS', aktif: true }
const atama = (id: string, ad: string, aktif: boolean, dilimli: boolean) => ({
  id, personnelId: `p-${id}`, personnel: { id: `p-${id}`, adSoyad: ad, sicilNo: null, bolum: 'Üretim', aktif: true },
  durakId: null, durak: null, baslangicTarihi: '2026-09-27', bitisTarihi: aktif ? null : '2026-10-01', aktif,
  durum: aktif ? 'AKTIF' : 'PASIF',
  dilimler: dilimli ? [{ id: `l-${id}`, dilimId: 'd1', dilim: SABAH }] : [],
})
const ATAMALAR = [atama('a1', 'Çağlar Şahin', true, false), atama('a2', 'İlker Öztürk', true, false), atama('a3', 'Eski Kayıt', false, false)]

let yazmaYaniti: { status: number; body: unknown }
let fetchMock: ReturnType<typeof vi.fn>

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })
const kartCagrilari = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/kapasite-toplu?guzergahId=g1')).length

beforeEach(() => {
  yazmaYaniti = { status: 200, body: { ok: true, data: {} } }
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    if (init?.method && init.method !== 'GET') return json(yazmaYaniti.status, yazmaYaniti.body)
    if (u.includes('dilim-onizle')) return json(200, { ok: true, data: {} })
    const veri =
      u.endsWith('/guzergah/g1') ? GUZERGAH
      : u.includes('sefer-dilimi') ? [SABAH]
      : u.endsWith('/personel-atama') ? ATAMALAR
      : u.includes('arac?durum=aktif') ? [{ id: 'ar1', plaka: '34LAC828' }]
      : u.includes('kapasite-toplu') ? { guzergahlar: [] }
      : []
    return json(200, { ok: true, data: veri })
  })
  vi.stubGlobal('fetch', fetchMock)
  window.history.pushState({}, '', '/servis-yonetimi/guzergah/g1')
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions: ['servis.view', 'servis.edit', 'servis.create', 'servis.passive', 'servis.restore', 'servis.tanim.manage'] } },
    status: 'authenticated',
  } as unknown as ReturnType<typeof useSession>)
})
afterEach(() => vi.unstubAllGlobals())

async function sekme(ad: string) {
  render(<GuzergahDetayPage />)
  fireEvent.mouseDown(await screen.findByRole('tab', { name: ad }), { button: 0 })
}

describe('C7-10 — üst kartlar yazma sonrası yenilenir', () => {
  it('açılışta kartlar bir kez çekilir', async () => {
    render(<GuzergahDetayPage />)
    await screen.findByRole('tab', { name: 'Duraklar' })
    await waitFor(() => expect(kartCagrilari()).toBe(1))
  })

  it('🔴 varsayılan araç ataması başarılı → kart çağrısı tekrarlanır', async () => {
    await sekme('Varsayılan Araçlar')
    await waitFor(() => expect((screen.getByRole('button', { name: /Yeni Atama/ }) as HTMLButtonElement).disabled).toBe(false))
    const once = kartCagrilari()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Atama/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(kartCagrilari()).toBe(once + 1))
  })

  it('🔴 başarısız araç ataması (400) → kart çağrısı TEKRARLANMAZ', async () => {
    yazmaYaniti = { status: 400, body: { ok: false, message: 'Kaydedilemedi.' } }
    await sekme('Varsayılan Araçlar')
    await waitFor(() => expect((screen.getByRole('button', { name: /Yeni Atama/ }) as HTMLButtonElement).disabled).toBe(false))
    const once = kartCagrilari()
    fireEvent.click(screen.getByRole('button', { name: /Yeni Atama/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kaydet' }))
    await screen.findByText('Kaydedilemedi.')
    expect(kartCagrilari()).toBe(once)
  })

  it('🔴 toplu Dilim Ata başarılı → kart çağrısı tekrarlanır', async () => {
    yazmaYaniti = { status: 200, body: { ok: true, data: { topluIslemId: 't1', degisen: 2, degismeyen: 0 } } }
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('dilim-onizle')) {
        return json(200, { ok: true, data: { atamaSayisi: 2, degisecek: 2, zatenVar: 0, dilimler: [{ id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi' }], etki: [], asimVar: false } })
      }
      if (init?.method && init.method !== 'GET') return json(200, yazmaYaniti.body)
      const veri = u.endsWith('/guzergah/g1') ? GUZERGAH : u.includes('sefer-dilimi') ? [SABAH] : u.endsWith('/personel-atama') ? ATAMALAR : u.includes('kapasite-toplu') ? { guzergahlar: [] } : []
      return json(200, { ok: true, data: veri })
    })
    await sekme('Personel Atamaları')
    await screen.findByText('Çağlar Şahin')
    const once = kartCagrilari()
    fireEvent.click(screen.getByRole('button', { name: /Dilimsiz atamaları seç/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Dilim Ata (2)' }))
    await screen.findByText('Dilim Ata — 2 atama')
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
    await screen.findByTestId('dilim-onizleme')
    fireEvent.click(screen.getByRole('button', { name: 'Uygula' }))
    await screen.findByText(/2 atamaya dilim eklendi/)
    await waitFor(() => expect(kartCagrilari()).toBe(once + 1))
  })

  it('🔴 başarısız toplu Dilim Ata (500) → kart çağrısı TEKRARLANMAZ', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('dilim-onizle')) {
        return json(200, { ok: true, data: { atamaSayisi: 2, degisecek: 2, zatenVar: 0, dilimler: [{ id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi' }], etki: [], asimVar: false } })
      }
      if (init?.method && init.method !== 'GET') return json(500, { ok: false, message: 'Sunucu hatası.' })
      const veri = u.endsWith('/guzergah/g1') ? GUZERGAH : u.includes('sefer-dilimi') ? [SABAH] : u.endsWith('/personel-atama') ? ATAMALAR : u.includes('kapasite-toplu') ? { guzergahlar: [] } : []
      return json(200, { ok: true, data: veri })
    })
    await sekme('Personel Atamaları')
    await screen.findByText('Çağlar Şahin')
    const once = kartCagrilari()
    fireEvent.click(screen.getByRole('button', { name: /Dilimsiz atamaları seç/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Dilim Ata (2)' }))
    await screen.findByText('Dilim Ata — 2 atama')
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/))
    await screen.findByTestId('dilim-onizleme')
    fireEvent.click(screen.getByRole('button', { name: 'Uygula' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('dilim-ata') && (i as RequestInit)?.method === 'POST')).toBe(true))
    await new Promise((r) => setTimeout(r, 50))
    expect(kartCagrilari()).toBe(once)
  })

  it('personel ataması geri al başarılı → kart çağrısı tekrarlanır', async () => {
    await sekme('Personel Atamaları')
    const satir = (await screen.findByText('Eski Kayıt')).closest('tr') as HTMLElement
    const once = kartCagrilari()
    fireEvent.click(within(satir).getByRole('button', { name: 'Geri Al' }))
    await waitFor(() => expect(kartCagrilari()).toBe(once + 1))
  })
})
