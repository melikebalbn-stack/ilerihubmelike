import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { SaatlerDialog } from './SaatlerDialog'

const guzergahDurak = {
  id: 'gd-1',
  durakId: 'durak-1',
  durak: { id: 'durak-1', kod: 'D1', ad: 'Durak 1', aktif: true },
  sira: 1,
  aktif: true,
  saatler: [
    {
      id: 'saat-1',
      dilimId: 'dilim-1',
      saat: '08:00',
      aktif: true,
      dilim: { id: 'dilim-1', kod: 'S1', ad: 'Sabah', yon: 'GIDIS' as const },
    },
  ],
}

const pasifSaatKaydi = {
  id: 'saat-2',
  dilimId: 'dilim-2',
  saat: '17:00',
  aktif: false,
  dilim: { id: 'dilim-2', kod: 'S2', ad: 'Akşam', yon: 'DONUS' as const },
}

const dilimler = [{ id: 'dilim-1', kod: 'S1', ad: 'Sabah', yon: 'GIDIS' as const }]

function baseProps(overrides: Partial<ComponentProps<typeof SaatlerDialog>> = {}) {
  return {
    guzergahId: 'guzergah-1',
    guzergahDurak,
    dilimler,
    canManage: true,
    canPassive: true,
    canRestore: true,
    onOpenChange: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('SaatlerDialog — Pasifleri göster toggle', () => {
  it('checkbox işaretlenince liste saatlerPasifDahil=true ile yeniden çekilir', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: [guzergahDurak] }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<SaatlerDialog {...baseProps()} />)
    fireEvent.click(screen.getByLabelText('Pasifleri göster'))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/servis-yonetimi/guzergah/guzergah-1/durak?saatlerPasifDahil=true'),
    )
  })

  it('checkbox işaretsizken pasif saat listesi hiç çekilmez/gösterilmez', () => {
    global.fetch = vi.fn() as unknown as typeof fetch
    render(<SaatlerDialog {...baseProps()} />)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.queryByText('Pasif saat kaydı yok.')).not.toBeInTheDocument()
  })
})

describe('SaatlerDialog — Geri Al', () => {
  it('servis.restore izni olan kullanıcı pasif satırda Geri Al butonunu görür ve tıklayınca doğru endpoint POST edilir', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: [{ ...guzergahDurak, saatler: [...guzergahDurak.saatler, pasifSaatKaydi] }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { ...pasifSaatKaydi, aktif: true } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: [{ ...guzergahDurak, saatler: [...guzergahDurak.saatler, { ...pasifSaatKaydi, aktif: true }] }],
        }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const onSaved = vi.fn()
    render(<SaatlerDialog {...baseProps({ onSaved })} />)
    fireEvent.click(screen.getByLabelText('Pasifleri göster'))
    await waitFor(() => expect(screen.getByText('Geri Al')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Geri Al'))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/servis-yonetimi/guzergah-durak-saat/saat-2/geri-al', {
        method: 'POST',
      }),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('servis.restore izni OLMAYAN kullanıcı "Pasifleri göster" açık olsa bile Geri Al butonunu GÖRMEZ', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: [{ ...guzergahDurak, saatler: [...guzergahDurak.saatler, pasifSaatKaydi] }],
      }),
    }) as unknown as typeof fetch

    render(<SaatlerDialog {...baseProps({ canRestore: false })} />)
    fireEvent.click(screen.getByLabelText('Pasifleri göster'))

    await waitFor(() => expect(screen.getByText(/17:00/)).toBeInTheDocument())
    expect(screen.queryByText('Geri Al')).not.toBeInTheDocument()
  })
})

describe('SaatlerDialog — Pasifleştir izin kontrolü (servis.passive)', () => {
  it('servis.passive izni olan kullanıcı aktif saat satırında Pasifleştir butonunu görür', () => {
    global.fetch = vi.fn() as unknown as typeof fetch
    render(<SaatlerDialog {...baseProps({ canPassive: true })} />)
    expect(screen.getByLabelText('Pasifleştir')).toBeInTheDocument()
  })

  it('servis.passive izni OLMAYAN kullanıcı aktif saat satırında Pasifleştir butonunu GÖRMEZ', () => {
    global.fetch = vi.fn() as unknown as typeof fetch
    render(<SaatlerDialog {...baseProps({ canPassive: false })} />)
    expect(screen.queryByLabelText('Pasifleştir')).not.toBeInTheDocument()
  })
})
