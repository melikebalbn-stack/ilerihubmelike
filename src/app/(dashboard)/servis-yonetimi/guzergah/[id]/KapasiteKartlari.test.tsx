import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { KapasiteKartlari } from './KapasiteKartlari'

const yanit = (guzergahlar: unknown[]) => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { guzergahlar } }) })
const satir = (ozet: object) => ({ guzergahId: 'g1', kod: 'G1', ad: 'A', dilimKod: 'SABAH', dilimSayisi: 2, araclar: [], dilimler: [], ozet })

afterEach(() => vi.unstubAllGlobals())

describe('KapasiteKartlari (güzergâh detayı)', () => {
  it('motor çıktısını 4 kart olarak gösterir; çağrı guzergahId ile', async () => {
    const f = vi.fn(async (_url: string) => yanit([satir({ kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 })]))
    vi.stubGlobal('fetch', f)
    render(<KapasiteKartlari guzergahId="g1" />)
    await waitFor(() => expect(screen.getByTestId('guzergah-kart-Koltuk').textContent).toBe('16'))
    expect(screen.getByTestId('guzergah-kart-Personel').textContent).toBe('12')
    expect(screen.getByTestId('guzergah-kart-Boş koltuk').textContent).toBe('4')
    expect(screen.getByTestId('guzergah-kart-Doluluk').textContent).toBe('%75.0')
    expect(String(f.mock.calls[0][0])).toContain('kapasite-toplu?guzergahId=g1')
  })

  it('araç yok → Koltuk/Boş/Doluluk "—", Personel sayısı görünür', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => yanit([satir({ kapasite: 0, atananPersonelSayisi: 3, bosKoltuk: -3, dolulukOrani: null, aracSayisi: 0, durum: 'ARAC_YOK', asimMiktari: 0 })])))
    render(<KapasiteKartlari guzergahId="g1" />)
    await waitFor(() => expect(screen.getByTestId('guzergah-kart-Personel').textContent).toBe('3'))
    expect(screen.getByTestId('guzergah-kart-Koltuk').textContent).toBe('—')
    expect(screen.getByTestId('guzergah-kart-Boş koltuk').textContent).toBe('—')
    expect(screen.getByTestId('guzergah-kart-Doluluk').textContent).toBe('—')
  })

  it('aşımda boş koltuk negatif ve kırmızı', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => yanit([satir({ kapasite: 10, atananPersonelSayisi: 12, bosKoltuk: -2, dolulukOrani: 120, aracSayisi: 1, durum: 'ASIM', asimMiktari: 2 })])))
    render(<KapasiteKartlari guzergahId="g1" />)
    const bos = await screen.findByTestId('guzergah-kart-Boş koltuk')
    expect(bos.textContent).toBe('-2')
    expect(bos.className).toContain('text-red-600')
  })

  it('hata ya da güzergâh yoksa hiçbir şey çizmez (sayfa bozulmaz)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: 'Yetersiz yetki' }) })))
    const { container } = render(<KapasiteKartlari guzergahId="g1" />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.innerHTML).toBe('')
  })
})
