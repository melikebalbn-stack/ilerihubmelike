import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import GuzergahDetayPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

const GUZERGAH = {
  id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, aktif: true,
  yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' },
  gecerlilikBaslangici: null, gecerlilikBitisi: null,
}
const gd = (n: number, ad: string, aktif = true) => ({
  id: `gd${n}`, durakId: `d${n}`, sira: n, aktif, saatler: [],
  durak: { id: `d${n}`, kod: `DARICA-0${n}`, ad, aktif: true },
})
const DURAKLAR = [gd(1, 'Cumhuriyet Meydanı'), gd(2, 'İtfaiye'), gd(3, 'Şekerpınar'), gd(4, 'Işık Market')]
const TUM_DURAKLAR = [
  ...DURAKLAR.map((d) => d.durak),
  { id: 'd9', kod: 'DARICA-09', ad: 'Yeni Durak', aktif: true },
]
const IDARI_ISLER = ['servis.view', 'servis.history', 'servis.tanim.manage']

function oturum(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } },
    status: 'authenticated',
  } as unknown as ReturnType<typeof useSession>)
}

let fetchMock: ReturnType<typeof vi.fn>
function fetchKur(mutasyon?: { ok: boolean; status: number; body: unknown }) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const y = mutasyon ?? { ok: true, status: 201, body: { ok: true, data: {} } }
      return { ok: y.ok, status: y.status, json: async () => y.body }
    }
    const veri =
      url.endsWith('/guzergah/g1') ? GUZERGAH
      : url.includes('/guzergah/g1/durak') ? DURAKLAR
      : url.includes('/durak?durum=aktif') ? TUM_DURAKLAR
      : []
    return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
  })
  vi.stubGlobal('fetch', fetchMock)
}

const postCagrilari = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => {
  fetchKur()
  oturum(IDARI_ISLER)
})

async function ekleDialoguAc() {
  render(<GuzergahDetayPage />)
  await waitFor(() => expect(screen.getByText(/DARICA-01 — Cumhuriyet Meydanı/)).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: /Durak Ekle/ }))
  await waitFor(() => expect(screen.getByText('Güzergaha Durak Ekle')).toBeTruthy())
}

describe('Güzergâh detay — araya durak ekleme (A2)', () => {
  it('Konum seçeneği: "Sona ekle" + her aktif durak için "N. sıraya ekle"', async () => {
    await ekleDialoguAc()
    const konum = screen.getByLabelText('Konum') as HTMLSelectElement
    const secenekler = within(konum).getAllByRole('option').map((o) => o.textContent)
    expect(secenekler[0]).toBe('Sona ekle')
    expect(secenekler).toHaveLength(1 + DURAKLAR.length)
    expect(secenekler[3]).toContain('3. sıraya ekle')
    expect(secenekler[3]).toContain('Şekerpınar')
    expect(konum.value).toBe('') // varsayılan: sona
  })

  it('3. sıraya ekle: POST gövdesi konum=3 taşır', async () => {
    await ekleDialoguAc()
    fireEvent.change(screen.getByLabelText('Durak *'), { target: { value: 'd9' } })
    fireEvent.change(screen.getByLabelText('Konum'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }))
    await waitFor(() => expect(postCagrilari()).toHaveLength(1))
    const [url, init] = postCagrilari()[0]
    expect(url).toBe('/api/servis-yonetimi/guzergah/g1/durak')
    expect(JSON.parse(init.body)).toEqual({ durakId: 'd9', konum: 3 })
  })

  it('konum seçilmezse gövdede konum YOK (sona ekler)', async () => {
    await ekleDialoguAc()
    fireEvent.change(screen.getByLabelText('Durak *'), { target: { value: 'd9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }))
    await waitFor(() => expect(postCagrilari()).toHaveLength(1))
    expect(JSON.parse(postCagrilari()[0][1].body)).toEqual({ durakId: 'd9' })
  })

  it('sunucu hatası (aralık dışı konum) Türkçe mesajla gösterilir', async () => {
    fetchKur({ ok: false, status: 400, body: { ok: false, message: 'Konum 1 ile 5 arasında olmalıdır.' } })
    await ekleDialoguAc()
    fireEvent.change(screen.getByLabelText('Durak *'), { target: { value: 'd9' } })
    fireEvent.change(screen.getByLabelText('Konum'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }))
    await waitFor(() => expect(screen.getByText('Konum 1 ile 5 arasında olmalıdır.')).toBeTruthy())
  })

  it('🔴 403: "Bu işlem için yetkiniz yok." gösterilir', async () => {
    fetchKur({ ok: false, status: 403, body: { error: 'Yetersiz yetki' } })
    await ekleDialoguAc()
    fireEvent.change(screen.getByLabelText('Durak *'), { target: { value: 'd9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }))
    await waitFor(() => expect(screen.getByText('Bu işlem için yetkiniz yok.')).toBeTruthy())
  })

  it('yetki katmanı: servis.tanim.manage yoksa "Durak Ekle" düğmesi görünmez', async () => {
    oturum(['servis.view'])
    render(<GuzergahDetayPage />)
    await waitFor(() => expect(screen.getByText(/DARICA-01 — Cumhuriyet Meydanı/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Durak Ekle/ })).toBeNull()
  })
})
