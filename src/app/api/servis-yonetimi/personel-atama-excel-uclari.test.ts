import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

// C2 uçları — GERÇEK requireAllPermissions ile: 401 (oturum yok), 403 (servis.view VEYA servis.edit eksik —
// biri tek başına YETMEZ), dosya doğrulamaları (boyut, biçim, sütun, satır sınırı), 409 aşım onayı,
// satır bazlı yetki (create/passive) bilgisinin servis katmanına iletilmesi, KVKK (iç kimlik sızmaz).
const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  onizle: vi.fn(),
  uygula: vi.fn(),
  guzergahFindMany: vi.fn(),
  dilimFindMany: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: mocks.getUserPermissions }))
vi.mock('@/lib/prisma', () => ({ prisma: { servisGuzergah: { findMany: mocks.guzergahFindMany }, servisSeferDilimi: { findMany: mocks.dilimFindMany } } }))
vi.mock('@/lib/servis-yonetimi/excel-atama', async (orijinal) => ({
  ...(await orijinal<typeof import('@/lib/servis-yonetimi/excel-atama')>()),
  excelOnizle: mocks.onizle,
  excelUygula: mocks.uygula,
}))

import { AtamaDilimHatasi } from '@/lib/servis-yonetimi/kapasite-asim'
import { EXCEL_LIMITLERI, SABLON_BASLIKLARI } from '@/lib/servis-yonetimi/excel-atama'
import { GET as SABLON } from './personel-atama-excel/sablon/route'
import { POST as ONIZLEME } from './personel-atama-excel/onizleme/route'
import { POST as UYGULA } from './personel-atama-excel/uygula/route'
import { POST as HATA_RAPORU } from './personel-atama-excel/hata-raporu/route'

function xlsx(satirlar: unknown[][], baslik: unknown[] = [...SABLON_BASLIKLARI]): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([baslik, ...satirlar]), 'Atama')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}
const GECERLI = xlsx([['101', 'DARICA', 'DK-01', 'SABAH_GIDIŞ', '2026-10-01']])

/** FormData taklidi (jsdom/undici sınırlarından bağımsız). */
function istek(alanlar: Record<string, unknown>) {
  return { formData: async () => ({ get: (k: string) => alanlar[k] ?? null }) } as unknown as Request
}
const dosya = (buf: Buffer, size = buf.length) => ({ size, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) })

function oturum(izinler: string[] | null) {
  if (izinler === null) return mocks.getServerSession.mockResolvedValue(null)
  mocks.getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserPermissions.mockResolvedValue(new Set(izinler))
}

const ONIZLEME_SONUCU = {
  ozet: { toplamSatir: 1, yeni: 1, degisiklik: 0, dilimEkle: 0, degismeyen: 0, hatali: 0, kapasiteUyarisi: 0 },
  satirlar: [{ satirNo: 2, sicil: '101', adSoyad: 'Çağlar Şahin', guzergahKod: 'DARICA', durakKod: 'DK-01', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: '2026-10-01', tur: 'YENI', hata: null, personnelId: 'GIZLI-PERSONEL-ID', guzergahId: 'GIZLI-GUZERGAH-ID' }],
  etki: [], asimVar: false, limitler: EXCEL_LIMITLERI, _baglam: { gizli: true },
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.onizle.mockResolvedValue(ONIZLEME_SONUCU)
  mocks.uygula.mockResolvedValue({ topluIslemId: 't1', yeni: 1, degisiklik: 0, dilimEkle: 0, degismeyen: 0, atlanan: 0 })
  mocks.guzergahFindMany.mockResolvedValue([{ kod: 'ÜSKÜDAR', ad: 'Üsküdar', duraklar: [{ durak: { kod: 'USK-01', ad: 'Şemsipaşa' } }] }])
  mocks.dilimFindMany.mockResolvedValue([{ kod: 'SABAH_GIDIŞ', ad: 'Sabah' }])
})

const POSTLAR = [
  { ad: 'onizleme', cagir: (r: Request) => ONIZLEME(r), fn: () => mocks.onizle },
  { ad: 'uygula', cagir: (r: Request) => UYGULA(r), fn: () => mocks.uygula },
  { ad: 'hata-raporu', cagir: (r: Request) => HATA_RAPORU(r), fn: () => mocks.onizle },
]

describe.each(POSTLAR)('$ad — yetki ve dosya doğrulaması', ({ cagir, fn }) => {
  it('oturum yok → 401', async () => {
    oturum(null)
    expect((await cagir(istek({ dosya: dosya(GECERLI) }))).status).toBe(401)
    expect(fn()).not.toHaveBeenCalled()
  })

  it.each([[[]], [['servis.view']], [['servis.edit']], [['servis.view', 'servis.create', 'servis.passive', 'servis.export']]])(
    '🔴 view VE edit birlikte gerekir; eksik (%j) → 403, dosya okunmaz',
    async (izinler) => {
      oturum(izinler)
      expect((await cagir(istek({ dosya: dosya(GECERLI) }))).status).toBe(403)
      expect(fn()).not.toHaveBeenCalled()
    },
  )

  it('dosya yok / metin alanı → 400', async () => {
    oturum(['servis.view', 'servis.edit'])
    expect((await cagir(istek({}))).status).toBe(400)
    expect((await cagir(istek({ dosya: 'metin' }))).status).toBe(400)
    expect(fn()).not.toHaveBeenCalled()
  })

  it('formData okunamazsa 400', async () => {
    oturum(['servis.view', 'servis.edit'])
    const bozuk = { formData: async () => { throw new Error('x') } } as unknown as Request
    expect((await cagir(bozuk)).status).toBe(400)
  })

  it('🔴 dosya boyut sınırı aşılırsa 413; .xlsx olmayan 400; eksik sütun 400; satır sınırı 400 (hepsi Türkçe mesaj)', async () => {
    oturum(['servis.view', 'servis.edit'])
    const buyuk = await cagir(istek({ dosya: dosya(GECERLI, EXCEL_LIMITLERI.maksDosyaBayt + 1) }))
    expect(buyuk.status).toBe(413)
    expect((await buyuk.json()).message).toContain('çok büyük')
    const csv = await cagir(istek({ dosya: dosya(Buffer.from('Sicil;Guzergah\n101;DARICA')) }))
    expect(csv.status).toBe(400)
    expect((await csv.json()).message).toContain('Yalnız .xlsx')
    const sutun = await cagir(istek({ dosya: dosya(xlsx([['a', 'b']], ['Ad', 'Soyad'])) }))
    expect((await sutun.json()).message).toContain('sütun(lar) bulunamadı')
    const cok = Array.from({ length: EXCEL_LIMITLERI.maksSatir + 1 }, (_, i) => [`S${i}`, 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01'])
    const satir = await cagir(istek({ dosya: dosya(xlsx(cok)) }))
    expect(satir.status).toBe(400)
    expect((await satir.json()).message).toContain('En fazla 500 satır')
    expect(fn()).not.toHaveBeenCalled()
  })
})

describe('önizleme', () => {
  it('🔴 view+edit → 200; iç kimlikler (personnelId, guzergahId, bağlam) istemciye SIZMAZ; ad soyad yetkili yanıtta var', async () => {
    oturum(['servis.view', 'servis.edit', 'servis.create'])
    const res = await ONIZLEME(istek({ dosya: dosya(GECERLI) }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.data.satirlar[0]).toEqual({ satirNo: 2, sicil: '101', adSoyad: 'Çağlar Şahin', guzergahKod: 'DARICA', durakKod: 'DK-01', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: '2026-10-01', tur: 'YENI', hata: null })
    expect(JSON.stringify(j)).not.toMatch(/GIZLI|_baglam/)
  })

  it('satır bazlı yetki bilgisi servis katmanına iletilir: create/passive var-yok', async () => {
    oturum(['servis.view', 'servis.edit'])
    await ONIZLEME(istek({ dosya: dosya(GECERLI) }))
    expect(mocks.onizle.mock.calls[0][1]).toEqual({ create: false, passive: false })
    oturum(['servis.view', 'servis.edit', 'servis.create', 'servis.passive'])
    await ONIZLEME(istek({ dosya: dosya(GECERLI) }))
    expect(mocks.onizle.mock.calls[1][1]).toEqual({ create: true, passive: true })
  })

  it('önizleme hatası 500 genel mesaj (iç hata/dosya içeriği sızmaz)', async () => {
    oturum(['servis.view', 'servis.edit'])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.onizle.mockRejectedValue(new Error('SELECT gizli 101'))
    const res = await ONIZLEME(istek({ dosya: dosya(GECERLI) }))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('gizli')
  })
})

describe('uygula', () => {
  it('başarılı → 200 + özet; kullanıcı kimliği, asimOnayi ve beklenen sayılar iletilir', async () => {
    oturum(['servis.view', 'servis.edit', 'servis.create'])
    const res = await UYGULA(istek({ dosya: dosya(GECERLI), asimOnayi: 'true', beklenenGecerli: '3', beklenenHatali: '1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).data.topluIslemId).toBe('t1')
    const [, girdi, kullanici, izin] = mocks.uygula.mock.calls[0]
    expect(girdi).toEqual({ asimOnayi: true, beklenen: { gecerli: 3, hatali: 1 } })
    expect(kullanici).toBe('u1')
    expect(izin).toEqual({ create: true, passive: false })
  })

  it('asimOnayi yalnız "true" ise; beklenen sayılar eksik/bozuksa iletilmez', async () => {
    oturum(['servis.view', 'servis.edit'])
    await UYGULA(istek({ dosya: dosya(GECERLI), asimOnayi: 'evet', beklenenGecerli: 'x' }))
    expect(mocks.uygula.mock.calls[0][1]).toEqual({ asimOnayi: false, beklenen: undefined })
  })

  it('🔴 aşım onayı gerekli → 409 + kod + etki', async () => {
    oturum(['servis.view', 'servis.edit'])
    mocks.uygula.mockRejectedValue(new AtamaDilimHatasi('aşım', 'ASIM_ONAYI_GEREKLI', { etki: [{ dilimKod: 'SABAH_GIDIŞ', fazla: 1 }] }))
    const res = await UYGULA(istek({ dosya: dosya(GECERLI) }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ ok: false, kod: 'ASIM_ONAYI_GEREKLI', ayrinti: { etki: [{ fazla: 1 }] } })
  })

  it('doğrulama hatası (geçerli satır yok / önizleme eskidi) → 400 Türkçe; satır hatası (rollback) → 400', async () => {
    oturum(['servis.view', 'servis.edit'])
    const { ExcelAtamaHatasi } = await import('@/lib/servis-yonetimi/excel-atama')
    mocks.uygula.mockRejectedValue(new ExcelAtamaHatasi('Uygulanacak geçerli satır yok.'))
    const a = await UYGULA(istek({ dosya: dosya(GECERLI) }))
    expect(a.status).toBe(400)
    expect((await a.json()).message).toBe('Uygulanacak geçerli satır yok.')
    mocks.uygula.mockRejectedValue(new AtamaDilimHatasi('Satır 3: Mevcut atama bu sırada değişti/kapandı. Hiçbir satır uygulanmadı.'))
    const b = await UYGULA(istek({ dosya: dosya(GECERLI) }))
    expect(b.status).toBe(400)
    expect((await b.json()).message).toContain('Hiçbir satır uygulanmadı')
  })

  it('beklenmeyen hata → 500, "hiçbir kayıt yazılmadı"; iç mesaj sızmaz', async () => {
    oturum(['servis.view', 'servis.edit'])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.uygula.mockRejectedValue(new Error('duplicate key value 101'))
    const res = await UYGULA(istek({ dosya: dosya(GECERLI) }))
    expect(res.status).toBe(500)
    const j = JSON.stringify(await res.json())
    expect(j).toContain('hiçbir kayıt yazılmadı')
    expect(j).not.toContain('duplicate')
  })
})

describe('hata raporu', () => {
  it('xlsx döner: ASCII dosya adı, Excel MIME; yalnız hatalı satırlar', async () => {
    oturum(['servis.view', 'servis.edit'])
    mocks.onizle.mockResolvedValue({ ...ONIZLEME_SONUCU, satirlar: [{ satirNo: 5, sicil: '999', guzergahKod: 'X', durakKod: '', dilimKodlari: [], baslangic: '', tur: 'HATA', hata: 'Sicil bulunamadı: 999.', adSoyad: null }] })
    const res = await HATA_RAPORU(istek({ dosya: dosya(GECERLI) }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="Atama-Hata-Raporu-\d{4}-\d{2}-\d{2}\.xlsx"$/)
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' })
    const t = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Hatalar'], { header: 1 })
    expect(t[1]).toEqual([5, '999', 'X', '', '', '', 'Sicil bulunamadı: 999.'])
  })
})

describe('şablon', () => {
  it('🔴 view+edit gerekir (401/403); xlsx şablonu: Atama/Açıklama/Kodlar, yalnız aktif kodlar', async () => {
    oturum(null)
    expect((await SABLON()).status).toBe(401)
    oturum(['servis.view'])
    expect((await SABLON()).status).toBe(403)
    expect(mocks.guzergahFindMany).not.toHaveBeenCalled()
    oturum(['servis.view', 'servis.edit'])
    const res = await SABLON()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="Personel-Atama-Sablonu.xlsx"')
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' })
    expect(wb.SheetNames).toEqual(['Atama', 'Açıklama', 'Kodlar'])
    expect(mocks.guzergahFindMany.mock.calls[0][0].where).toEqual({ aktif: true })
    expect(mocks.dilimFindMany.mock.calls[0][0].where).toEqual({ aktif: true })
  })

  it('veri hatası → 500 genel mesaj', async () => {
    oturum(['servis.view', 'servis.edit'])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.guzergahFindMany.mockRejectedValue(new Error('db'))
    expect((await SABLON()).status).toBe(500)
  })
})
