import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import ServisYonetimiPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

// prisma/seed-servis-role-mapping.ts: idari-isler'de servis.passive / servis.restore YOK.
const IDARI_ISLER = [
  'servis.view', 'servis.create', 'servis.edit', 'servis.history',
  'servis.tanim.manage', 'servis.sorumlu.manage',
]
const HR_YONETICISI = [...IDARI_ISLER, 'servis.passive', 'servis.restore']

const FIRMALAR = [
  { id: 'f1', ad: 'ŞAHİN Taşımacılık', yetkiliAdi: null, telefon: null, eposta: null, adres: null, aktif: true },
  { id: 'f2', ad: 'IŞIK Servis', yetkiliAdi: null, telefon: null, eposta: null, adres: null, aktif: false },
]

function oturum(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } },
    status: 'authenticated',
  } as unknown as ReturnType<typeof useSession>)
}

let fetchMock: ReturnType<typeof vi.fn>

function fetchKur(mutasyonYaniti?: { ok: boolean; status: number; body: unknown }) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const y = mutasyonYaniti ?? { ok: true, status: 200, body: { ok: true } }
      return { ok: y.ok, status: y.status, json: async () => y.body }
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, data: url.includes('/firma') ? FIRMALAR : [] }) }
  })
  vi.stubGlobal('fetch', fetchMock)
}

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => fetchKur())

describe('Servis ekranı — Pasifleştir / Geri Al yetkisi (idari-isler senaryosu)', () => {
  it('🔴 idari-isler: Düzenle görünür, Pasifleştir ve Geri Al GÖRÜNMEZ', async () => {
    oturum(IDARI_ISLER)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())

    expect(screen.getAllByRole('button', { name: 'Düzenle' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Pasifleştir' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Geri Al' })).toBeNull()
  })

  it('servis.passive + servis.restore olan kullanıcı ikisini de görür', async () => {
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())

    expect(screen.getByRole('button', { name: 'Pasifleştir' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Geri Al' })).toBeTruthy()
  })

  it('yalnız servis.passive: Pasifleştir var, Geri Al yok', async () => {
    oturum([...IDARI_ISLER, 'servis.passive'])
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Pasifleştir' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Geri Al' })).toBeNull()
  })

  it('yalnız servis.history (düzenleme yok): İşlem sütununda yalnız Geçmiş', async () => {
    oturum(['servis.view', 'servis.history'])
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Düzenle' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pasifleştir' })).toBeNull()
  })

  it('izin yoksa ekran render edilmez (sayfa katmanı)', () => {
    oturum([])
    render(<ServisYonetimiPage />)
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeTruthy()
  })
})

describe('Servis ekranı — mutasyon hata gösterimi', () => {
  it('🔴 403: "Bu işlem için yetkiniz yok." gösterilir, liste yeniden istenmez', async () => {
    fetchKur({ ok: false, status: 403, body: { error: 'Yetersiz yetki' } })
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    const listeCagrisi = () => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/firma') && !i).length
    const oncekiListe = listeCagrisi()

    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    await waitFor(() => expect(screen.getByText('Bu işlem için yetkiniz yok.')).toBeTruthy())
    expect(listeCagrisi()).toBe(oncekiListe)
  })

  it('geri alma 403 de aynı mesajı gösterir', async () => {
    fetchKur({ ok: false, status: 403, body: { error: 'Yetersiz yetki' } })
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('IŞIK Servis')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Geri Al' }))
    await waitFor(() => expect(screen.getByText('Bu işlem için yetkiniz yok.')).toBeTruthy())
  })

  it('sunucunun Türkçe hata mesajı olduğu gibi gösterilir', async () => {
    fetchKur({ ok: false, status: 409, body: { ok: false, message: 'Bağlı aktif kayıt var.' } })
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    await waitFor(() => expect(screen.getByText('Bağlı aktif kayıt var.')).toBeTruthy())
  })

  it('başarılı pasifleştirme: hata yok, liste yeniden yüklenir', async () => {
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    const listeCagrisi = () => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/firma') && !i).length
    const once = listeCagrisi()
    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    await waitFor(() => expect(listeCagrisi()).toBe(once + 1))
    expect(screen.queryByText('Bu işlem için yetkiniz yok.')).toBeNull()
  })

  it('Türkçe karakterli arama (İ/ı/Ş) bu yetki değişikliğinden etkilenmedi', async () => {
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Firma ara'), { target: { value: 'sahin' } })
    expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy()
    expect(screen.queryByText('IŞIK Servis')).toBeNull()
    fireEvent.change(screen.getByLabelText('Firma ara'), { target: { value: 'ışık' } })
    expect(screen.getByText('IŞIK Servis')).toBeTruthy()
  })
})
