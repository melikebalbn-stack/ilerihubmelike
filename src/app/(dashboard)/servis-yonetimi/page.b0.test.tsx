import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import ServisYonetimiPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

// B0 — görünüm: başlık açıklaması, firma tablosu sayı sütunları (KVKK: şoför yalnız sayı),
// sekmelerde ortak yoğunluk, Türkçe karakterle arama.
const FIRMALAR = [
  { id: 'f1', ad: 'ŞAHİN Taşımacılık', yetkiliAdi: 'Ayşe Yılmaz', telefon: '0262 111 22 33', eposta: null, adres: null, aktif: true, _count: { araclar: 3, soforler: 2 } },
  { id: 'f2', ad: 'IŞIK Servis', yetkiliAdi: null, telefon: null, eposta: null, adres: null, aktif: false, _count: { araclar: 0, soforler: 0 } },
  { id: 'f3', ad: 'Eski Tip Firma', yetkiliAdi: null, telefon: null, eposta: null, adres: null, aktif: true }, // _count yok (geriye dönük)
]

function oturum(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({ data: { user: { permissions } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)
}

beforeEach(() => {
  oturum(['servis.view', 'servis.tanim.manage'])
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true, status: 200, json: async () => ({ ok: true, data: String(url).includes('/firma') ? FIRMALAR : [] }),
  })))
})
afterEach(() => vi.unstubAllGlobals())

describe('B0 — başlık', () => {
  it('🔴 "FAZ 1/A — servis tanım verileri." kaldırıldı; kalıcı açıklama var', async () => {
    render(<ServisYonetimiPage />)
    expect(screen.queryByText(/FAZ 1\/A/)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Servis Yönetimi' })).toBeTruthy()
    expect(screen.getByText(/Firma, yerleşke, güzergâh, durak, araç, şoför ve sefer dilimi tanımlarını yönetin\./)).toBeTruthy()
    expect(screen.getByText(/Atama ve kapasite takibi güzergâh detayından yapılır\./)).toBeTruthy()
  })
})

describe('B0 — firma tablosu', () => {
  it('sütunlar: Ad, Yetkili, Telefon, Aktif Araç, Aktif Şoför, Durum, İşlem', async () => {
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Ad', 'Yetkili', 'Telefon', 'Aktif Araç', 'Aktif Şoför', 'Durum', 'İşlem',
    ])
  })

  it('🔴 aktif araç/şoför SAYILARI satırda görünür; şoför için yalnız sayı (ad/telefon yok)', async () => {
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    const satir = screen.getByText('ŞAHİN Taşımacılık').closest('tr')!
    const hucreler = within(satir).getAllByRole('cell').map((c) => c.textContent)
    expect(hucreler.slice(3, 5)).toEqual(['3', '2'])
    // şoför isim/telefon alanı bu ekrana gelmez
    expect(satir.textContent).not.toMatch(/şoför adı|sürücü/i)
  })

  it('pasif firma 0/0; _count olmayan eski yanıt 0 gösterilir (çökmez)', async () => {
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('IŞIK Servis')).toBeTruthy())
    const pasif = within(screen.getByText('IŞIK Servis').closest('tr')!).getAllByRole('cell').map((c) => c.textContent)
    expect(pasif.slice(3, 5)).toEqual(['0', '0'])
    const eski = within(screen.getByText('Eski Tip Firma').closest('tr')!).getAllByRole('cell').map((c) => c.textContent)
    expect(eski.slice(3, 5)).toEqual(['0', '0'])
  })

  it('boş liste: mesaj tüm sütunları kapsar (colSpan 7)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: [] }) })))
    render(<ServisYonetimiPage />)
    const hucre = await screen.findByText('Kayıt yok.')
    expect(hucre.getAttribute('colspan')).toBe('7')
  })

  it('Türkçe büyük harf/İ-ı-Ş arama bozulmadı ("sahin" → ŞAHİN, "ısık" → IŞIK)', async () => {
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Firma ara'), { target: { value: 'sahin' } })
    expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy()
    expect(screen.queryByText('IŞIK Servis')).toBeNull()
    fireEvent.change(screen.getByLabelText('Firma ara'), { target: { value: 'ışık' } })
    expect(screen.getByText('IŞIK Servis')).toBeTruthy()
    expect(screen.queryByText('ŞAHİN Taşımacılık')).toBeNull()
  })
})

describe('B0 — diğer tanım sekmelerinde aynı yoğunluk', () => {
  it.each(['Yerleşkeler', 'Güzergâhlar', 'Duraklar', 'Araçlar', 'Şoförler', 'Sefer Dilimleri'])(
    '%s sekmesi: başlık satırları kompakt (h-9) ve hücreler kompakt (py-1.5)',
    async (sekme) => {
      render(<ServisYonetimiPage />)
      fireEvent.mouseDown(screen.getByRole('tab', { name: sekme }), { button: 0 })
      await waitFor(() => expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0))
      for (const h of screen.getAllByRole('columnheader')) expect(h.className).toContain('h-9')
      for (const c of screen.getAllByRole('cell')) expect(c.className).toContain('py-1.5')
    },
  )
})
