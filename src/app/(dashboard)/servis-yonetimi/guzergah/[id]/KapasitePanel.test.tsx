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
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { kapasite: 20, atananPersonelSayisi: 10, bosKoltuk: 10, dolulukOrani: 50 } }) })
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
      json: async () => ({ ok: true, data: { kapasite: 16, atananPersonelSayisi: 17, bosKoltuk: -1, dolulukOrani: 106.25 } }),
    }) as unknown as typeof fetch

    render(<KapasitePanel guzergahId="g1" dilimler={[dilimler[0]]} />)

    await waitFor(() => expect(screen.getByText('Kapasite aşımı')).toBeInTheDocument())
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('%106.3')).toBeInTheDocument()
  })
})
