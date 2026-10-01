import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import ServisYonetimiPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

// Sefer Dilimleri sekmesi filtresi — Türkçe karakterle (normalizeTr: diyakritik
// ve büyük/küçük harf duyarsız).
const DILIMLER = [
  { id: 'd1', kod: 'SABAH_GIDIS', ad: 'IŞIK Vardiyası', yon: 'GIDIS', grupKodu: null, sira: 1, aktif: true },
  { id: 'd2', kod: 'AKSAM_DONUS', ad: 'Şahin Servisi', yon: 'DONUS', grupKodu: null, sira: 2, aktif: true },
]

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions: ['servis.view'] } },
    status: 'authenticated',
  } as unknown as ReturnType<typeof useSession>)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ ok: true, data: url.includes('/sefer-dilimi') ? DILIMLER : [] }),
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function seferDilimleriniAc() {
  render(<ServisYonetimiPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sefer Dilimleri' }), { button: 0 })
  await waitFor(() => expect(screen.getByText('IŞIK Vardiyası')).toBeTruthy())
}

describe('Servis Yönetimi — Sefer Dilimleri arama (normalizeTr)', () => {
  it('"isik" yazınca "IŞIK Vardiyası" kalır, diğer dilim süzülür', async () => {
    await seferDilimleriniAc()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'isik' } })
    expect(screen.getByText('IŞIK Vardiyası')).toBeTruthy()
    expect(screen.queryByText('Şahin Servisi')).toBeNull()
  })

  it.each([
    ['ışık', 'IŞIK Vardiyası', 'Şahin Servisi'],
    ['ŞAHİN', 'Şahin Servisi', 'IŞIK Vardiyası'],
    ['sahin', 'Şahin Servisi', 'IŞIK Vardiyası'],
  ])('"%s" → yalnız "%s"', async (terim, kalan, giden) => {
    await seferDilimleriniAc()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: terim } })
    expect(screen.getByText(kalan)).toBeTruthy()
    expect(screen.queryByText(giden)).toBeNull()
  })

  it('eşleşmeyen terimde boş sonuç mesajı çıkar', async () => {
    await seferDilimleriniAc()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'olmayan' } })
    expect(screen.getByText('Aramayla eşleşen sefer dilimi yok.')).toBeTruthy()
  })
})
