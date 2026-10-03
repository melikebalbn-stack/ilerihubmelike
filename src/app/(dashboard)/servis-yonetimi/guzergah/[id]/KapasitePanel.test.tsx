import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { KapasitePanel } from './KapasitePanel'

const dilimler = [
  { id: 'd1', kod: 'SABAH', ad: 'Sabah Gidiş', yon: 'GIDIS' as const },
  { id: 'd2', kod: 'AKSAM', ad: 'Akşam Dönüş', yon: 'DONUS' as const },
]

beforeEach(() => vi.restoreAllMocks())

describe('KapasitePanel', () => {
  it('her aktif dilim için canonical endpointi çağırıp özeti gösterir', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { kapasite: 20, atananPersonelSayisi: 10, bosKoltuk: 10, dolulukOrani: 50, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 } }) })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<KapasitePanel guzergahId="g1" dilimler={dilimler} />)

    await waitFor(() => expect(screen.getByText('SABAH — Sabah Gidiş')).toBeInTheDocument())
    expect(screen.getByText('AKSAM — Akşam Dönüş')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/servis-yonetimi/guzergah/g1/kapasite?')
    expect(String(fetchMock.mock.calls[0][0])).toContain('dilimId=d1')
  })

  it('negatif boş koltukta kapasite aşımı uyarısını gösterir', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { kapasite: 16, atananPersonelSayisi: 17, bosKoltuk: -1, dolulukOrani: 106.25, aracSayisi: 1, durum: 'ASIM', asimMiktari: 1 } }),
    }) as unknown as typeof fetch

    render(<KapasitePanel guzergahId="g1" dilimler={[dilimler[0]]} />)

    await waitFor(() => expect(screen.getByText('Kapasite aşımı · Aşım +1')).toBeInTheDocument())
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('%106.3')).toBeInTheDocument()
  })

  it('🔴 aracı olmayan dilim: koltuk/boş/doluluk "—", rozet "Araç yok" (0 ya da %100 gösterilmez)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { kapasite: 0, atananPersonelSayisi: 3, bosKoltuk: -3, dolulukOrani: null, aracSayisi: 0, durum: 'ARAC_YOK', asimMiktari: 0 } }),
    }) as unknown as typeof fetch

    render(<KapasitePanel guzergahId="g1" dilimler={[dilimler[0]]} />)

    await waitFor(() => expect(screen.getByText('Araç yok')).toBeInTheDocument())
    expect(screen.getAllByText('—')).toHaveLength(3) // koltuk, boş, doluluk
    expect(screen.queryByText('%100.0')).toBeNull()
    expect(screen.queryByText('%0.0')).toBeNull()
    expect(screen.queryByText('-3')).toBeNull() // araçsızlık "aşım" gibi görünmez
    expect(screen.queryByText(/aşım/i)).toBeNull()
    expect(screen.getByText('3')).toBeInTheDocument() // atanan personel
  })

  it('dolmak üzere (≥%90) sarı rozet', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { kapasite: 20, atananPersonelSayisi: 19, bosKoltuk: 1, dolulukOrani: 95, aracSayisi: 1, durum: 'DOLMAK_UZERE', asimMiktari: 0 } }),
    }) as unknown as typeof fetch
    render(<KapasitePanel guzergahId="g1" dilimler={[dilimler[0]]} />)
    await waitFor(() => expect(screen.getByText('Dolmak üzere')).toBeInTheDocument())
    expect(screen.getByText('%95.0')).toBeInTheDocument()
  })
})
