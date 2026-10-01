import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SikayetciSecici } from './SikayetciSecici'

const ADAY = { id: 'p1', adSoyad: 'Elif Demir', sicilNo: 'S-100', bolum: 'Montaj' }

function yaz(terim: string) {
  render(<SikayetciSecici value="" onChange={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText(/Sicil No veya Ad Soyad/), { target: { value: terim } })
}

const bekle = { timeout: 3000 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SikayetciSecici — uç cevabına göre mesaj', () => {
  it('uç kayıt döndürürse liste gösterilir, hata/boş mesajı yok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [ADAY] })
    vi.stubGlobal('fetch', fetchMock)
    yaz('ELİF')
    await waitFor(() => expect(screen.getByText(/Elif Demir/)).toBeTruthy(), bekle)
    expect(fetchMock.mock.calls[0][0]).toBe(
      `/api/servis-yonetimi/sikayet/sikayetci-secici?arama=${encodeURIComponent('ELİF')}`,
    )
    expect(screen.queryByText('Arama yapılamadı')).toBeNull()
    expect(screen.queryByText('Sonuç bulunamadı')).toBeNull()
  })

  it('uç boş dizi döndürürse "Sonuç bulunamadı" (hata mesajı DEĞİL)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    yaz('olmayan')
    await waitFor(() => expect(screen.getByText('Sonuç bulunamadı')).toBeTruthy(), bekle)
    expect(screen.queryByText('Arama yapılamadı')).toBeNull()
  })

  it.each([403, 404, 500])('uç %i dönerse "Arama yapılamadı" (boş sonuç mesajı DEĞİL)', async (durum) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: durum, json: async () => ({}) }))
    yaz('elif')
    await waitFor(() => expect(screen.getByText('Arama yapılamadı')).toBeTruthy(), bekle)
    expect(screen.queryByText('Sonuç bulunamadı')).toBeNull()
  })

  it('ağ hatası (fetch reddedilir) "Arama yapılamadı" gösterir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    yaz('elif')
    await waitFor(() => expect(screen.getByText('Arama yapılamadı')).toBeTruthy(), bekle)
    expect(screen.queryByText('Sonuç bulunamadı')).toBeNull()
  })

  it('hata sonrası başarılı arama hata mesajını temizler', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [ADAY] })
    vi.stubGlobal('fetch', fetchMock)
    render(<SikayetciSecici value="" onChange={() => {}} />)
    const input = screen.getByPlaceholderText(/Sicil No veya Ad Soyad/)
    fireEvent.change(input, { target: { value: 'el' } })
    await waitFor(() => expect(screen.getByText('Arama yapılamadı')).toBeTruthy(), bekle)
    fireEvent.change(input, { target: { value: 'eli' } })
    await waitFor(() => expect(screen.getByText(/Elif Demir/)).toBeTruthy(), bekle)
    expect(screen.queryByText('Arama yapılamadı')).toBeNull()
  })
})
