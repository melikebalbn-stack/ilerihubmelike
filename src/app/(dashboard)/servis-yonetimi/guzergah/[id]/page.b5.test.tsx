import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import GuzergahDetayPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))

// B5 — Personel Atamaları: Dilim sütunu / "Dilim yok" rozeti, Dilim Düzenle (tek), Dilim Ata (toplu).
const GUZERGAH = {
  id: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', aciklama: null, bolge: null, aktif: true,
  yerleskeId: 'y1', yerleske: { id: 'y1', kod: 'Y1', ad: 'Merkez' }, gecerlilikBaslangici: null, gecerlilikBitisi: null,
}
const SABAH = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi', yon: 'GIDIS', aktif: true }
const AKSAM = { id: 'd2', kod: 'AKŞAM_DÖNÜŞ', ad: 'Akşam Servisi', yon: 'DONUS', aktif: true }
const atama = (id: string, ad: string, dilimler: typeof SABAH[], aktif = true) => ({
  id, personnelId: `p-${id}`, personnel: { id: `p-${id}`, adSoyad: ad, sicilNo: null, bolum: 'Üretim', aktif: true },
  durakId: null, durak: null, baslangicTarihi: '2026-09-27', bitisTarihi: null, aktif,
  dilimler: dilimler.map((d) => ({ id: `l-${id}-${d.id}`, dilimId: d.id, dilim: d })),
})
const ATAMALAR = [
  atama('a1', 'Çağlar Şahin', [SABAH]),
  atama('a2', 'İlker Öztürk', []),
  atama('a3', 'Ayşe Yılmaz', []),
  atama('a4', 'Eski Kayıt', [], false), // pasif: seçilemez
]
const ONIZLEME = {
  atamaSayisi: 2, degisecek: 2, zatenVar: 0, dilimler: [{ id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi' }],
  etki: [{ dilimId: 'd1', dilimKod: 'SABAH_GIDIŞ', dilimAd: 'Sabah Servisi', once: 8, sonra: 10, koltuk: 10, aracYok: false, asim: false, fazla: 0 }],
  asimVar: false,
}

function oturum(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({ data: { user: { permissions } }, status: 'authenticated' } as unknown as ReturnType<typeof useSession>)
}

type Cevap = { status?: number; body: unknown }
let cevaplar: Record<string, Cevap>
let fetchMock: ReturnType<typeof vi.fn>

function fetchKur() {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    for (const [parca, c] of Object.entries(cevaplar)) {
      if (u.includes(parca)) return { ok: (c.status ?? 200) < 400, status: c.status ?? 200, json: async () => c.body }
    }
    const veri =
      u.endsWith('/guzergah/g1') ? GUZERGAH
      : u.includes('sefer-dilimi') ? [SABAH, AKSAM]
      : u.endsWith('/personel-atama') ? ATAMALAR
      : u.includes('kapasite-toplu') ? { guzergahlar: [] }
      : []
    void init
    return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
  })
  vi.stubGlobal('fetch', fetchMock)
}
const cagrilar = (parca: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(parca))
const govde = (c: unknown[]) => JSON.parse((c[1] as RequestInit).body as string)

async function personelSekmesi() {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Personel Atamaları' }), { button: 0 })
  await screen.findByText('Çağlar Şahin')
}

beforeEach(() => {
  cevaplar = {}
  fetchKur()
  window.history.pushState({}, '', '/servis-yonetimi/guzergah/g1')
  oturum(['servis.view', 'servis.edit'])
})
afterEach(() => vi.unstubAllGlobals())

describe('Personel Atamaları — Dilim sütunu', () => {
  it('bağlı dilimler kod olarak; dilimsiz atamada "Dilim yok" rozeti; uyarı sayısı', async () => {
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    const satir = (ad: string) => screen.getByText(ad).closest('tr') as HTMLElement
    expect(within(satir('Çağlar Şahin')).getByText('SABAH_GIDIŞ')).toBeTruthy()
    expect(within(satir('İlker Öztürk')).getByText('Dilim yok')).toBeTruthy()
    expect(screen.getByTestId('dilimsiz-uyari').textContent).toContain('2 aktif atamanın sefer dilimi yok')
    expect(screen.getByRole('button', { name: /Dilimsiz atamaları seç \(2\)/ })).toBeTruthy()
  })

  it('🔴 yalnız servis.view: rozet görünür ama seçim kutuları, Dilim Düzenle ve toplu butonlar YOK', async () => {
    oturum(['servis.view'])
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    expect(screen.getAllByText('Dilim yok').length).toBe(3) // a2, a3 (aktif) + a4 (pasif)
    expect(screen.queryByRole('button', { name: 'Dilim Düzenle' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Dilimsiz atamaları seç/ })).toBeNull()
    expect(screen.queryByLabelText('Tüm aktif atamaları seç')).toBeNull()
    expect(screen.queryByTestId('dilimsiz-uyari')).toBeNull()
  })

  it('pasif atamada seçim kutusu ve Dilim Düzenle yok', async () => {
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    const pasif = screen.getByText('Eski Kayıt').closest('tr') as HTMLElement
    expect(within(pasif).queryByRole('checkbox')).toBeNull()
    expect(within(pasif).queryByRole('button', { name: 'Dilim Düzenle' })).toBeNull()
  })
})

describe('Veri Kalite bağlantısı', () => {
  it('?sekme=personel-atama&dilimsiz=1 → Personel sekmesi açık, dilimsiz atamalar seçili, "Dilim Ata (2)" hazır', async () => {
    window.history.pushState({}, '', '/servis-yonetimi/guzergah/g1?sekme=personel-atama&dilimsiz=1')
    render(<GuzergahDetayPage />)
    await screen.findByText('Çağlar Şahin') // sekmeye tıklamadan
    expect(await screen.findByRole('button', { name: 'Dilim Ata (2)' })).toBeTruthy()
    expect((screen.getByLabelText('İlker Öztürk seç') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Çağlar Şahin seç') as HTMLInputElement).checked).toBe(false)
  })

  it('parametre yoksa varsayılan sekme Duraklar, seçim yok', async () => {
    render(<GuzergahDetayPage />)
    await screen.findByRole('tab', { name: 'Duraklar' })
    expect(screen.queryByText('Çağlar Şahin')).toBeNull()
  })
})

describe('Toplu Dilim Ata', () => {
  async function topluAc() {
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    fireEvent.click(screen.getByRole('button', { name: /Dilimsiz atamaları seç/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Dilim Ata (2)' }))
    await screen.findByText('Dilim Ata — 2 atama')
  }
  const sabahKutusu = () => screen.getByLabelText(/SABAH_GIDIŞ/)

  it('normal: dilim seç → önizleme (N atama, dilim, personel a → b / koltuk k) → Uygula → tek istek, başarı mesajı', async () => {
    cevaplar['dilim-onizle'] = { body: { ok: true, data: ONIZLEME } }
    cevaplar['dilim-ata'] = { body: { ok: true, data: { topluIslemId: 't1', degisen: 2, degismeyen: 0 } } }
    await topluAc()
    expect((screen.getByRole('button', { name: 'Uygula' }) as HTMLButtonElement).disabled).toBe(true) // dilim yok → kapalı
    fireEvent.click(sabahKutusu())
    const onizleme = await screen.findByTestId('dilim-onizleme')
    expect(onizleme.textContent).toContain('2 atama')
    expect(onizleme.textContent).toContain('SABAH_GIDIŞ')
    expect(onizleme.textContent).toContain('SABAH_GIDIŞ: personel 8 → 10 / koltuk 10')
    expect(govde(cagrilar('dilim-onizle')[0])).toEqual({ atamaIdleri: ['a2', 'a3'], dilimIdleri: ['d1'] })
    fireEvent.click(screen.getByRole('button', { name: 'Uygula' }))
    await screen.findByText('2 atamaya dilim eklendi.')
    expect(cagrilar('dilim-ata')).toHaveLength(1)
    expect(govde(cagrilar('dilim-ata')[0])).toEqual({ atamaIdleri: ['a2', 'a3'], dilimIdleri: ['d1'], asimOnayi: false })
  })

  it('🔴 aşım: kırmızı uyarı + "Uygula" onay kutusu işaretlenene kadar kapalı; onayla → asimOnayi:true', async () => {
    cevaplar['dilim-onizle'] = {
      body: { ok: true, data: { ...ONIZLEME, asimVar: true, etki: [{ ...ONIZLEME.etki[0], sonra: 11, asim: true, fazla: 1 }] } },
    }
    cevaplar['dilim-ata'] = { body: { ok: true, data: { topluIslemId: 't1', degisen: 2, degismeyen: 0 } } }
    await topluAc()
    fireEvent.click(sabahKutusu())
    await screen.findByText('Kapasite aşılacak')
    expect(screen.getByText(/AŞIM \+1/)).toBeTruthy()
    const uygula = screen.getByRole('button', { name: 'Uygula' }) as HTMLButtonElement
    expect(uygula.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Aşımı biliyorum, devam et'))
    expect(uygula.disabled).toBe(false)
    fireEvent.click(uygula)
    await waitFor(() => expect(cagrilar('dilim-ata')).toHaveLength(1))
    expect(govde(cagrilar('dilim-ata')[0]).asimOnayi).toBe(true)
  })

  it('araçsız dilim: "araç yok" gösterilir, aşım uyarısı yok', async () => {
    cevaplar['dilim-onizle'] = {
      body: { ok: true, data: { ...ONIZLEME, etki: [{ ...ONIZLEME.etki[0], koltuk: null, aracYok: true, once: 3, sonra: 5 }] } },
    }
    await topluAc()
    fireEvent.click(sabahKutusu())
    const onizleme = await screen.findByTestId('dilim-onizleme')
    expect(onizleme.textContent).toContain('personel 3 → 5 / araç yok')
    expect(screen.queryByText('Kapasite aşılacak')).toBeNull()
  })

  it('kullanıcı hatası: önizleme hatası Türkçe gösterilir, Uygula kapalı kalır', async () => {
    cevaplar['dilim-onizle'] = { status: 400, body: { ok: false, message: '"ESKİ" dilimi pasif, atama yapılamaz.' } }
    await topluAc()
    fireEvent.click(sabahKutusu())
    expect(await screen.findByText('"ESKİ" dilimi pasif, atama yapılamaz.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Uygula' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('güvenli geri dönüş: uygulama hatası (hiçbiri uygulanmadı) mesajı gösterilir, diyalog açık kalır', async () => {
    cevaplar['dilim-onizle'] = { body: { ok: true, data: ONIZLEME } }
    cevaplar['dilim-ata'] = { status: 400, body: { ok: false, message: 'Atamalardan biri bu sırada kapatıldı; işlem uygulanmadı.' } }
    await topluAc()
    fireEvent.click(sabahKutusu())
    await screen.findByTestId('dilim-onizleme')
    fireEvent.click(screen.getByRole('button', { name: 'Uygula' }))
    expect(await screen.findByText('Atamalardan biri bu sırada kapatıldı; işlem uygulanmadı.')).toBeTruthy()
    expect(screen.getByText('Dilim Ata — 2 atama')).toBeTruthy()
  })

  it('hepsinde zaten var: "değişiklik yok", Uygula kapalı', async () => {
    cevaplar['dilim-onizle'] = { body: { ok: true, data: { ...ONIZLEME, degisecek: 0, zatenVar: 2 } } }
    await topluAc()
    fireEvent.click(sabahKutusu())
    expect(await screen.findByText(/hepsinde bu dilimler zaten var/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Uygula' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Tüm aktif atamaları seç kutusu yalnız aktif atamaları seçer (pasif hariç)', async () => {
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    fireEvent.click(screen.getByLabelText('Tüm aktif atamaları seç'))
    expect(await screen.findByRole('button', { name: 'Dilim Ata (3)' })).toBeTruthy()
  })
})

describe('Tek atama — Dilim Düzenle', () => {
  async function ac(ad: string) {
    render(<GuzergahDetayPage />)
    await personelSekmesi()
    const satir = screen.getByText(ad).closest('tr') as HTMLElement
    fireEvent.click(within(satir).getByRole('button', { name: 'Dilim Düzenle' }))
    await screen.findByText(`Sefer Dilimlerini Düzenle — ${ad}`)
  }

  it('dilim ekle: mevcut seçili gelir, yalnız eklenen PATCH gövdesine girer', async () => {
    cevaplar['/dilimler'] = { body: { ok: true, data: {} } }
    await ac('Çağlar Şahin')
    expect((screen.getByLabelText(/SABAH_GIDIŞ/) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement).disabled).toBe(true) // değişiklik yok
    fireEvent.click(screen.getByLabelText(/AKŞAM_DÖNÜŞ/))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(cagrilar('/dilimler')).toHaveLength(1))
    expect(cagrilar('/dilimler')[0][0]).toContain('/guzergah-personel-atama/a1/dilimler')
    expect(govde(cagrilar('/dilimler')[0])).toMatchObject({ ekle: ['d2'], cikar: [] })
  })

  it('🔴 hiç dilim kalacaksa: sunucu 409 → uyarı + onay kutusu; onaylanmadan "Onayla ve Uygula" kapalı; onayla → dilimsizOnayi:true', async () => {
    let cagri = 0
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/dilimler')) {
        cagri++
        if (cagri === 1) {
          return { ok: false, status: 409, json: async () => ({ ok: false, kod: 'DILIMSIZ_ONAYI_GEREKLI', message: 'Bu işlem atamanın hiç sefer dilimini bırakmayacak; dilimsiz atama kapasiteye girmez. Devam etmek için onay gerekir.' }) }
        }
        return { ok: true, status: 200, json: async () => ({ ok: true, data: {} }) }
      }
      const veri = u.endsWith('/guzergah/g1') ? GUZERGAH : u.includes('sefer-dilimi') ? [SABAH, AKSAM] : u.endsWith('/personel-atama') ? ATAMALAR : u.includes('kapasite-toplu') ? { guzergahlar: [] } : []
      void init
      return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
    })
    await ac('Çağlar Şahin')
    fireEvent.click(screen.getByLabelText(/SABAH_GIDIŞ/)) // çıkar → hiç dilim kalmaz
    expect(screen.getByText(/hiç sefer dilimi kalmayacak/)).toBeTruthy() // ön uyarı
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await screen.findByText('Atamanın dilimsiz kalmasını onaylıyorum')
    const onayla = screen.getByRole('button', { name: 'Onayla ve Uygula' }) as HTMLButtonElement
    expect(onayla.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Atamanın dilimsiz kalmasını onaylıyorum'))
    fireEvent.click(onayla)
    await waitFor(() => expect(cagrilar('/dilimler')).toHaveLength(2))
    expect(govde(cagrilar('/dilimler')[1])).toMatchObject({ cikar: ['d1'], dilimsizOnayi: true })
  })

  it('🔴 aşım (409): kırmızı uyarı + "Aşımı biliyorum" onayı; onayla → asimOnayi:true', async () => {
    let cagri = 0
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.includes('/dilimler')) {
        cagri++
        return cagri === 1
          ? { ok: false, status: 409, json: async () => ({ ok: false, kod: 'ASIM_ONAYI_GEREKLI', message: 'aşım', ayrinti: { etki: [{ dilimId: 'd2', dilimKod: 'AKŞAM_DÖNÜŞ', once: 10, sonra: 11, koltuk: 10, asim: true, fazla: 1, aracYok: false, dilimAd: 'A' }] } }) }
          : { ok: true, status: 200, json: async () => ({ ok: true, data: {} }) }
      }
      const veri = u.endsWith('/guzergah/g1') ? GUZERGAH : u.includes('sefer-dilimi') ? [SABAH, AKSAM] : u.endsWith('/personel-atama') ? ATAMALAR : u.includes('kapasite-toplu') ? { guzergahlar: [] } : []
      return { ok: true, status: 200, json: async () => ({ ok: true, data: veri }) }
    })
    await ac('Çağlar Şahin')
    fireEvent.click(screen.getByLabelText(/AKŞAM_DÖNÜŞ/))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await screen.findByText('Kapasite aşılacak')
    expect(screen.getByText(/AKŞAM_DÖNÜŞ: personel 10 → 11 \/ koltuk 10/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Aşımı biliyorum, devam et'))
    fireEvent.click(screen.getByRole('button', { name: 'Onayla ve Uygula' }))
    await waitFor(() => expect(cagrilar('/dilimler')).toHaveLength(2))
    expect(govde(cagrilar('/dilimler')[1])).toMatchObject({ ekle: ['d2'], asimOnayi: true })
  })

  it('dilimsiz atamaya dilim ekle (Türkçe karakterli kodlar), sunucu hatası mesajla gösterilir', async () => {
    cevaplar['/dilimler'] = { status: 400, body: { ok: false, message: 'Pasif atamaya dilim eklenemez/çıkarılamaz. Önce atamayı geri alın.' } }
    await ac('İlker Öztürk')
    expect((screen.getByLabelText(/SABAH_GIDIŞ/) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByLabelText(/AKŞAM_DÖNÜŞ/))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText(/Pasif atamaya dilim eklenemez/)).toBeTruthy()
  })
})
