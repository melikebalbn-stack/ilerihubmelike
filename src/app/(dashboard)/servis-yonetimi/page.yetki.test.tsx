import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

describe('Servis ekranı — A4: bağlı aktif kayıt onayı', () => {
  const BAG = [
    { tur: 'ARAC', etiket: 'Aktif araç', sayi: 7, ornekler: ['41P0145', '41P0327', '41P4607', '41P5093', '41P5573'] },
    { tur: 'SOFOR', etiket: 'Aktif şoför', sayi: 2, ornekler: [] },
  ]
  const GOVDE409 = { ok: false, kod: 'BAGLI_KAYIT_VAR', message: 'Firma pasifleştirilemez: bağlı aktif kayıtlar var.', bagimliliklar: BAG }

  function fetchSirali(postYanitlari: { ok: boolean; status: number; body: unknown }[]) {
    const sira = [...postYanitlari]
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const y = sira.shift() ?? { ok: true, status: 200, body: { ok: true } }
        return { ok: y.ok, status: y.status, json: async () => y.body }
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, data: url.includes('/firma') ? FIRMALAR : [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
  }
  const postlar = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')

  async function pasiflestirTikla() {
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    await waitFor(() => expect(screen.getByText('Bağlı aktif kayıtlar var')).toBeTruthy())
  }

  it('🔴 409: bağlı kayıt listesi gösterilir, pasifleştirme HENÜZ yapılmaz (tek POST)', async () => {
    fetchSirali([{ ok: false, status: 409, body: GOVDE409 }])
    await pasiflestirTikla()
    const liste = screen.getByRole('list', { name: 'Bağlı aktif kayıtlar' })
    expect(within(liste).getByText('Aktif araç: 7')).toBeTruthy()
    expect(within(liste).getByText(/41P0145, 41P0327, 41P4607, 41P5093, 41P5573 ve 2 tane daha/)).toBeTruthy()
    expect(within(liste).getByText('Aktif şoför: 2')).toBeTruthy()
    expect(screen.getByText(/aktif kalır/)).toBeTruthy()
    expect(postlar()).toHaveLength(1)
    expect(JSON.parse(String(postlar()[0][1].body ?? 'null'))).toBeNull() // ilk istek gövdesiz = onaysız
  })

  it('🔴 KVKK: şoför grubunda örnek (ad) satırı çıkmaz, yalnız sayı', async () => {
    fetchSirali([{ ok: false, status: 409, body: GOVDE409 }])
    await pasiflestirTikla()
    const soforSatiri = screen.getByText('Aktif şoför: 2').closest('li')!
    expect(soforSatiri.textContent).toBe('Aktif şoför: 2')
  })

  it('"Yine de Pasifleştir": { onay: true } ile ikinci POST, ardından liste yenilenir', async () => {
    fetchSirali([
      { ok: false, status: 409, body: GOVDE409 },
      { ok: true, status: 200, body: { ok: true } },
    ])
    await pasiflestirTikla()
    const once = fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/firma') && !i).length
    fireEvent.click(screen.getByRole('button', { name: 'Yine de Pasifleştir' }))
    await waitFor(() => expect(postlar()).toHaveLength(2))
    expect(postlar()[1][0]).toBe('/api/servis-yonetimi/firma/f1/pasiflestir')
    expect(JSON.parse(postlar()[1][1].body)).toEqual({ onay: true })
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/firma') && !i).length).toBe(once + 1),
    )
    expect(screen.queryByText('Bağlı aktif kayıtlar var')).toBeNull()
  })

  it('"Vazgeç": ikinci istek atılmaz, diyalog kapanır', async () => {
    fetchSirali([{ ok: false, status: 409, body: GOVDE409 }])
    await pasiflestirTikla()
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    await waitFor(() => expect(screen.queryByText('Bağlı aktif kayıtlar var')).toBeNull())
    expect(postlar()).toHaveLength(1)
  })

  it('bağlı kayıt yoksa diyalog hiç çıkmaz (tek POST, doğrudan pasifleştirir)', async () => {
    fetchSirali([{ ok: true, status: 200, body: { ok: true } }])
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    await waitFor(() => expect(postlar()).toHaveLength(1))
    expect(screen.queryByText('Bağlı aktif kayıtlar var')).toBeNull()
  })
})

describe('Servis ekranı — A4: kod değişikliği engeli kullanıcıya diyalogda gösterilir', () => {
  const GUZERGAH = {
    id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, yerleskeId: 'y1',
    yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, aktif: true,
    gecerlilikBaslangici: null, gecerlilikBitisi: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  }
  const KOD_MESAJI = 'Bu güzergâhın kodu değiştirilemez: 3 personel ataması, 1 şikâyet bu kodla ilişkili. Ad serbestçe değiştirilebilir.'

  it('🔴 PUT 400: engel mesajı düzenleme diyaloğunun İÇİNDE (role=alert) görünür ve diyalog açık kalır', async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return { ok: false, status: 400, json: async () => ({ ok: false, message: KOD_MESAJI }) }
      }
      const veri = url.includes('/guzergah') ? [GUZERGAH] : url.includes('/yerleske') ? [{ id: 'y1', kod: 'Y1', ad: 'Merkez', aktif: true }] : []
      return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    oturum(IDARI_ISLER)
    render(<ServisYonetimiPage />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Güzergâhlar' }), { button: 0 })
    await waitFor(() => expect(screen.getByText('Darıca Hattı')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    const uyari = await screen.findByRole('alert')
    expect(uyari.textContent).toBe(KOD_MESAJI)
    expect(screen.getByText('Güzergâhı Düzenle')).toBeTruthy()
  })
})

describe('Servis ekranı — A5: firma zinciri (pasifleştirme + seçici geri alma)', () => {
  const NOT = 'Araçlar yeni firmaya geçiyorsa önce araçların firmasını değiştirin.'
  const ZINCIR409 = {
    ok: false, kod: 'BAGLI_KAYIT_VAR', message: 'Firma pasifleştirilirse bağlı aktif kayıtlar birlikte pasifleşir/kapanır.',
    bagimliliklar: [
      { tur: 'ARAC', etiket: 'Aktif araç', sayi: 2, ornekler: ['41P0145', '41P0327'] },
      { tur: 'SOFOR', etiket: 'Aktif şoför', sayi: 1, ornekler: [] },
      { tur: 'ARAC_VARSAYILAN', etiket: 'Aktif varsayılan araç ataması', sayi: 2, ornekler: ['DARICA — Darıca Hattı (SABAH_GIDIS)'] },
    ],
    zincirleme: true, notlar: [NOT],
  }
  const ONIZLEME = { zincirIslemId: 'z1', geriAlinabilirArac: 2, geriAlinabilirSofor: 1, kapananAtama: 3 }

  function kurFirma(opts: { post?: { ok: boolean; status: number; body: unknown }[]; onizleme?: unknown }) {
    const sira = [...(opts.post ?? [])]
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const y = sira.shift() ?? { ok: true, status: 200, body: { ok: true } }
        return { ok: y.ok, status: y.status, json: async () => y.body }
      }
      if (String(url).endsWith('/geri-al-onizleme')) {
        return { ok: true, status: 200, json: async () => ({ ok: true, data: opts.onizleme }) }
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, data: url.includes('/firma') ? FIRMALAR : [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
  }
  const postlar = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')

  it('🔴 pasifleştirme diyaloğu: birlikte pasifleşecekler + güzergâh adlı atama + şoför yalnız SAYI + yeni firma notu', async () => {
    kurFirma({ post: [{ ok: false, status: 409, body: ZINCIR409 }] })
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    await waitFor(() => expect(screen.getByText('Bağlı aktif kayıtlar var')).toBeTruthy())

    expect(screen.getByText(/birlikte pasifleşir \/ kapanır/)).toBeTruthy()
    const liste = screen.getByRole('list', { name: 'Bağlı aktif kayıtlar' })
    expect(within(liste).getByText('Aktif araç: 2')).toBeTruthy()
    expect(within(liste).getByText('41P0145, 41P0327')).toBeTruthy()
    expect(within(liste).getByText(/DARICA — Darıca Hattı \(SABAH_GIDIS\)/)).toBeTruthy()
    expect(within(liste).getByText('Aktif şoför: 1').closest('li')!.textContent).toBe('Aktif şoför: 1') // KVKK
    expect(screen.getByText(NOT)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Firmayı ve Bağlı Kayıtları Pasifleştir' })).toBeTruthy()
    expect(postlar()).toHaveLength(1) // henüz hiçbir şey pasifleşmedi
  })

  it('onay: { onay: true } ile ikinci POST', async () => {
    kurFirma({ post: [{ ok: false, status: 409, body: ZINCIR409 }, { ok: true, status: 200, body: { ok: true } }] })
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('ŞAHİN Taşımacılık')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    await waitFor(() => expect(screen.getByText('Bağlı aktif kayıtlar var')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Firmayı ve Bağlı Kayıtları Pasifleştir' }))
    await waitFor(() => expect(postlar()).toHaveLength(2))
    expect(JSON.parse(postlar()[1][1].body)).toEqual({ onay: true })
  })

  it('🔴 geri al: "Birlikte pasifleşen 3 kayıt da geri alınsın mı?" + atama bilgisi; "Birlikte Geri Al" → zincirGeriAl: true', async () => {
    kurFirma({ onizleme: ONIZLEME, post: [{ ok: true, status: 200, body: { ok: true } }] })
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('IŞIK Servis')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Geri Al' }))

    await waitFor(() => expect(screen.getByText('Birlikte pasifleşen 3 kayıt da geri alınsın mı?')).toBeTruthy())
    const liste = screen.getByRole('list', { name: 'Birlikte geri alınabilecek kayıtlar' })
    expect(within(liste).getByText('Araç: 2')).toBeTruthy()
    expect(within(liste).getByText('Şoför: 1')).toBeTruthy()
    expect(screen.getByText(/3 varsayılan atama kapatılmıştı/)).toBeTruthy()
    expect(screen.getByText(/geri alınmaz/)).toBeTruthy()
    expect(postlar()).toHaveLength(0) // önizleme GET'ti; henüz geri alma yok

    fireEvent.click(screen.getByRole('button', { name: 'Birlikte Geri Al' }))
    await waitFor(() => expect(postlar()).toHaveLength(1))
    expect(postlar()[0][0]).toBe('/api/servis-yonetimi/firma/f2/geri-al')
    expect(JSON.parse(postlar()[0][1].body)).toEqual({ zincirGeriAl: true })
  })

  it('"Yalnız Firmayı Geri Al": gövdesiz POST', async () => {
    kurFirma({ onizleme: ONIZLEME, post: [{ ok: true, status: 200, body: { ok: true } }] })
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('IŞIK Servis')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Geri Al' }))
    await waitFor(() => expect(screen.getByText(/geri alınsın mı/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Yalnız Firmayı Geri Al' }))
    await waitFor(() => expect(postlar()).toHaveLength(1))
    expect(postlar()[0][1]).toEqual({ method: 'POST' })
  })

  it('birlikte geri alınacak kayıt yoksa diyalog çıkmaz; doğrudan geri alır', async () => {
    kurFirma({ onizleme: { ...ONIZLEME, geriAlinabilirArac: 0, geriAlinabilirSofor: 0 }, post: [{ ok: true, status: 200, body: { ok: true } }] })
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    await waitFor(() => expect(screen.getByText('IŞIK Servis')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Geri Al' }))
    await waitFor(() => expect(postlar()).toHaveLength(1))
    expect(screen.queryByText(/geri alınsın mı/)).toBeNull()
  })

  it('yerleşke/güzergâh pasifinde zincirleme YOK: mevcut "aktif kalır" uyarısı', async () => {
    const GUZ = {
      id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, yerleskeId: 'y1',
      yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, aktif: true, gecerlilikBaslangici: null, gecerlilikBitisi: null,
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    }
    let ilkPost = true
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && ilkPost) {
        ilkPost = false
        return {
          ok: false, status: 409,
          json: async () => ({
            ok: false, kod: 'BAGLI_KAYIT_VAR', message: 'Güzergâh pasifleştirilemez: bağlı aktif kayıtlar var.',
            bagimliliklar: [{ tur: 'PERSONEL_ATAMA', etiket: 'Aktif personel ataması', sayi: 12, ornekler: [] }],
            zincirleme: false, notlar: [],
          }),
        }
      }
      const veri = url.includes('/guzergah') ? [GUZ] : url.includes('/yerleske') ? [{ id: 'y1', kod: 'Y1', ad: 'Merkez', aktif: true }] : []
      return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    oturum(HR_YONETICISI)
    render(<ServisYonetimiPage />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Güzergâhlar' }), { button: 0 })
    await waitFor(() => expect(screen.getByText('Darıca Hattı')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    await waitFor(() => expect(screen.getByText('Bağlı aktif kayıtlar var')).toBeTruthy())
    expect(screen.getByText(/aktif kalır/)).toBeTruthy()
    expect(screen.queryByText(/birlikte pasifleşir/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Yine de Pasifleştir' })).toBeTruthy()
  })
})
