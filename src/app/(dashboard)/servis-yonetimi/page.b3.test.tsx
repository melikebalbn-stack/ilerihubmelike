import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import ServisYonetimiPage from './page'
import GuzergahDetayPage from './guzergah/[id]/page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

// B3 — dışa aktarma düğmeleri: servis.view VE servis.export birlikte (API de AND ister).
const GUZERGAH = {
  id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, aktif: true,
  yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, gecerlilikBaslangici: null, gecerlilikBitisi: null,
}

function oturum(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({ data: { user: { permissions } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true, status: 200,
    json: async () => ({ ok: true, data: String(url).endsWith('/guzergah/g1') ? GUZERGAH : [] }),
  })))
})
afterEach(() => vi.unstubAllGlobals())

describe('Servis Yönetimi ana sayfa — export düğmeleri', () => {
  it('view + export → Güzergâh Listesi ve Personel Atama Listesi (Excel) bağlantıları', () => {
    oturum(['servis.view', 'servis.export'])
    render(<ServisYonetimiPage />)
    expect(screen.getByText('Güzergâh Listesi (Excel)').closest('a')?.getAttribute('href')).toBe('/api/servis-yonetimi/export/guzergah-listesi')
    expect(screen.getByText('Personel Atama Listesi (Excel)').closest('a')?.getAttribute('href')).toBe('/api/servis-yonetimi/export/personel-atama-listesi')
  })

  it('🔴 yalnız servis.view → düğme YOK', () => {
    oturum(['servis.view'])
    render(<ServisYonetimiPage />)
    expect(screen.queryByText(/\(Excel\)/)).toBeNull()
  })

  it('🔴 yalnız servis.export (view yok) → sayfa ve düğme YOK', () => {
    oturum(['servis.export'])
    render(<ServisYonetimiPage />)
    expect(screen.queryByText(/\(Excel\)/)).toBeNull()
    expect(screen.getByText(/yetkiniz yok/)).toBeTruthy()
  })
})

describe('Güzergâh detayı — PDF düğmesi', () => {
  it('view + export → Güzergâh Detayı (PDF) bağlantısı güzergâh kimliğiyle', async () => {
    oturum(['servis.view', 'servis.export'])
    render(<GuzergahDetayPage />)
    const d = await screen.findByText('Güzergâh Detayı (PDF)')
    expect(d.closest('a')?.getAttribute('href')).toBe('/api/servis-yonetimi/export/guzergah-detay/g1')
  })

  it('🔴 yalnız servis.view → düğme YOK (sayfa görünür)', async () => {
    oturum(['servis.view'])
    render(<GuzergahDetayPage />)
    await waitFor(() => expect(screen.getByText(/DARICA — Darıca Hattı/)).toBeTruthy())
    expect(screen.queryByText('Güzergâh Detayı (PDF)')).toBeNull()
  })
})
