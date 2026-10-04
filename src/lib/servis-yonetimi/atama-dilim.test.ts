import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// B5 — atamaya sefer dilimi ekleme/çıkarma. Gerçek servis kodu + bellek-içi SAHTE DB
// (transaction semantiği dahil: hata → yazılanların HEPSİ geri alınır).
// ============================================================================

type Atama = { id: string; guzergahId: string; aktif: boolean; baslangicTarihi: Date; bitisTarihi: Date | null; dilimler: { dilimId: string }[] }
type Dilim = { id: string; kod: string; ad: string; aktif: boolean }
type Gecmis = { hedefTipi: string; hedefId: string; islem: string; userId: string | null; oncekiDeger: unknown; yeniDeger: Record<string, unknown>; aciklama: string | null }

const db = vi.hoisted(() => ({
  atamalar: new Map<string, unknown>(),
  dilimler: [] as unknown[],
  gecmis: [] as unknown[],
  /** tx içinde, N. atama güncel okunurken kapatılır (yarış simülasyonu). */
  txteKapat: null as string | null,
  gecmisYazilamaz: false,
  /** C5-3: transaction İÇİNDEKİ sorgu (round-trip) sayısı. */
  txSorgu: 0,
  kapasite: {} as Record<string, { atananPersonelSayisi: number; kapasite: number; durum: string }>,
}))

vi.mock('@/lib/prisma', () => {
  const klon = <T,>(x: T): T => structuredClone(x)
  const atamaOku = (m: Map<string, unknown>, id: string) => m.get(id) as Atama | undefined
  const model = (atamalar: Map<string, unknown>, gecmis: unknown[]) => ({
    servisSeferDilimi: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        (db.dilimler as Dilim[]).filter((d) => where.id.in.includes(d.id)).map((d) => ({ ...d })),
    },
    servisPersonelAtama: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => atamaOku(atamalar, id)).filter(Boolean).map((a) => klon(a)),
      findUnique: async ({ where }: { where: { id: string } }) => {
        db.txSorgu++
        if (db.txteKapat === where.id) { const a = atamaOku(atamalar, where.id); if (a) a.aktif = false }
        const a = atamaOku(atamalar, where.id)
        return a ? { aktif: a.aktif } : null
      },
    },
    servisPersonelAtamaDilim: {
      createMany: async ({ data }: { data: { atamaId: string; dilimId: string }[] }) => {
        db.txSorgu++
        for (const d of data) {
          const a = atamaOku(atamalar, d.atamaId)!
          if (a.dilimler.some((x) => x.dilimId === d.dilimId)) throw new Error('unique ihlali')
          a.dilimler.push({ dilimId: d.dilimId })
        }
      },
      deleteMany: async ({ where }: { where: { atamaId: string; dilimId: { in: string[] } } }) => {
        db.txSorgu++
        const a = atamaOku(atamalar, where.atamaId)!
        a.dilimler = a.dilimler.filter((x) => !where.dilimId.in.includes(x.dilimId))
      },
    },
    servisIslemGecmisi: {
      create: async ({ data }: { data: unknown }) => {
        db.txSorgu++
        if (db.gecmisYazilamaz) throw new Error('audit yazılamadı')
        gecmis.push(klon(data))
      },
    },
  })
  return {
    prisma: {
      ...model(db.atamalar, db.gecmis),
      // Transaction: çalışma kopyası; başarıyla biterse COMMIT, hata → atılır (rollback).
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const kopya = new Map<string, unknown>([...db.atamalar].map(([k, v]) => [k, klon(v)]))
        const gecmisKopya: unknown[] = []
        const sonuc = await fn(model(kopya, gecmisKopya))
        db.atamalar.clear()
        for (const [k, v] of kopya) db.atamalar.set(k, v)
        db.gecmis.push(...gecmisKopya)
        return sonuc
      },
    },
  }
})
vi.mock('./kapasite', () => ({
  servisKapasiteOzetiGetir: async (_g: string, dilimId: string) => db.kapasite[dilimId],
}))

import {
  AtamaDilimHatasi, TOPLU_DILIM_ATAMA_LIMITI, atamaDilimleriniGuncelle, atamaGunuKapsar,
  dilimFarki, etkiSatiriOlustur, topluDilimAta, topluDilimOnizle,
} from './atama-dilim'

const GUN = '2026-10-03'
const SABAH: Dilim = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi', aktif: true }
const AKSAM: Dilim = { id: 'd2', kod: 'AKŞAM_DÖNÜŞ', ad: 'Akşam Servisi', aktif: true }
const ESKI: Dilim = { id: 'd3', kod: 'ESKİ', ad: 'Eski', aktif: false }

function atama(id: string, dilimIdleri: string[] = [], o: Partial<Atama> = {}): Atama {
  return { id, guzergahId: 'g1', aktif: true, baslangicTarihi: new Date('2026-09-27'), bitisTarihi: null, dilimler: dilimIdleri.map((dilimId) => ({ dilimId })), ...o }
}
function kur(atamalar: Atama[]) {
  db.atamalar.clear()
  atamalar.forEach((a) => db.atamalar.set(a.id, a))
}
const dilimlerOf = (id: string) => (db.atamalar.get(id) as Atama).dilimler.map((d) => d.dilimId).sort()
const gecmis = () => db.gecmis as Gecmis[]

beforeEach(() => {
  db.atamalar.clear()
  db.gecmis.length = 0
  db.dilimler = [SABAH, AKSAM, ESKI]
  db.txteKapat = null
  db.gecmisYazilamaz = false
  db.txSorgu = 0
  // d1: 10 koltuk, 8 personel; d2: araç yok, 3 personel
  db.kapasite = {
    d1: { atananPersonelSayisi: 8, kapasite: 10, durum: 'UYGUN' },
    d2: { atananPersonelSayisi: 3, kapasite: 0, durum: 'ARAC_YOK' },
    d3: { atananPersonelSayisi: 0, kapasite: 0, durum: 'ARAC_YOK' },
  }
})

describe('saf yardımcılar', () => {
  it('dilimFarki: eklenen/çıkarılan/sonraki; zaten olan ekleme ve olmayan çıkarma yok sayılır', () => {
    expect(dilimFarki(['a', 'b'], ['b', 'c'], ['a', 'z'])).toEqual({ eklenen: ['c'], cikarilan: ['a'], sonraki: ['b', 'c'] })
    expect(dilimFarki([], ['a', 'a'], [])).toEqual({ eklenen: ['a'], cikarilan: [], sonraki: ['a'] })
  })

  it('atamaGunuKapsar: başlangıç ≤ gün ≤ bitiş (bitiş yok = süresiz)', () => {
    const a = { baslangicTarihi: new Date('2026-09-27'), bitisTarihi: null }
    expect(atamaGunuKapsar(a, GUN)).toBe(true)
    expect(atamaGunuKapsar({ ...a, baslangicTarihi: new Date('2026-10-10') }, GUN)).toBe(false) // henüz başlamadı
    expect(atamaGunuKapsar({ ...a, bitisTarihi: new Date('2026-10-02') }, GUN)).toBe(false) // bitti
    expect(atamaGunuKapsar({ ...a, bitisTarihi: new Date('2026-10-03') }, GUN)).toBe(true)
  })

  it('etkiSatiriOlustur: aşım yalnız araçlı dilimde ve ekleme olunca; araç yok → koltuk null, aşım yok', () => {
    const d = { id: 'd1', kod: 'S', ad: 'S' }
    expect(etkiSatiriOlustur(d, { atananPersonelSayisi: 8, kapasite: 10, durum: 'UYGUN' }, 2)).toMatchObject({ once: 8, sonra: 10, koltuk: 10, asim: false })
    expect(etkiSatiriOlustur(d, { atananPersonelSayisi: 8, kapasite: 10, durum: 'UYGUN' }, 3)).toMatchObject({ sonra: 11, asim: true, fazla: 1 })
    expect(etkiSatiriOlustur(d, { atananPersonelSayisi: 3, kapasite: 0, durum: 'ARAC_YOK' }, 5)).toMatchObject({ sonra: 8, koltuk: null, aracYok: true, asim: false })
    // zaten aşımda ama bu işlem kimseyi eklemiyor → yeni uyarı yok
    expect(etkiSatiriOlustur(d, { atananPersonelSayisi: 12, kapasite: 10, durum: 'ASIM' }, 0).asim).toBe(false)
  })
})

describe('topluDilimOnizle — YAZMAZ', () => {
  it('N atama, dilim, kapasite etkisi: personel a → b / koltuk k', async () => {
    kur([atama('a1'), atama('a2'), atama('a3', ['d1'])])
    const o = await topluDilimOnizle('g1', { atamaIdleri: ['a1', 'a2', 'a3'], dilimIdleri: ['d1'] }, GUN)
    expect(o).toMatchObject({ atamaSayisi: 3, degisecek: 2, zatenVar: 1, asimVar: false })
    expect(o.etki).toEqual([expect.objectContaining({ dilimKod: 'SABAH_GIDIŞ', once: 8, sonra: 10, koltuk: 10, asim: false })])
    expect(dilimlerOf('a1')).toEqual([]) // hiçbir şey yazılmadı
    expect(gecmis()).toHaveLength(0)
  })

  it('🔴 aşım olacaksa asimVar + fazla; araçsız dilimde aşım YOK ama "araç yok" bilgisi', async () => {
    kur([atama('a1'), atama('a2'), atama('a3')])
    const o = await topluDilimOnizle('g1', { atamaIdleri: ['a1', 'a2', 'a3'], dilimIdleri: ['d1', 'd2'] }, GUN)
    expect(o.asimVar).toBe(true)
    expect(o.etki.find((e) => e.dilimId === 'd1')).toMatchObject({ once: 8, sonra: 11, asim: true, fazla: 1 })
    expect(o.etki.find((e) => e.dilimId === 'd2')).toMatchObject({ once: 3, sonra: 6, koltuk: null, aracYok: true, asim: false })
  })

  it('henüz başlamamış atama bugün kapasiteye girmez → etkiye eklenmez', async () => {
    kur([atama('a1', [], { baslangicTarihi: new Date('2026-11-01') }), atama('a2')])
    const o = await topluDilimOnizle('g1', { atamaIdleri: ['a1', 'a2'], dilimIdleri: ['d1'] }, GUN)
    expect(o.etki[0].sonra).toBe(9) // yalnız a2
    expect(o.degisecek).toBe(2) // ama ikisine de dilim eklenecek
  })

  it('🔴 kullanıcı hataları: boş seçim, limit aşımı, başka güzergâh, pasif atama, pasif/olmayan dilim, dilim seçilmedi', async () => {
    kur([atama('a1'), atama('b1', [], { guzergahId: 'g2' }), atama('p1', [], { aktif: false })])
    const hata = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e)
    expect((await hata(topluDilimOnizle('g1', { atamaIdleri: [], dilimIdleri: ['d1'] }, GUN)))?.message).toContain('En az bir atama')
    expect((await hata(topluDilimOnizle('g1', { atamaIdleri: Array.from({ length: TOPLU_DILIM_ATAMA_LIMITI + 1 }, (_, i) => `x${i}`), dilimIdleri: ['d1'] }, GUN)))?.message).toContain(`en fazla ${TOPLU_DILIM_ATAMA_LIMITI}`)
    expect((await hata(topluDilimOnizle('g1', { atamaIdleri: ['a1', 'b1'], dilimIdleri: ['d1'] }, GUN)))?.message).toContain('bu güzergâha ait değil')
    expect((await hata(topluDilimOnizle('g1', { atamaIdleri: ['p1'], dilimIdleri: ['d1'] }, GUN)))?.message).toContain('Pasif atamaya')
    expect((await hata(topluDilimOnizle('g1', { atamaIdleri: ['a1'], dilimIdleri: ['d3'] }, GUN)))?.message).toContain('"ESKİ" dilimi pasif')
    expect((await hata(topluDilimOnizle('g1', { atamaIdleri: ['a1'], dilimIdleri: ['yok'] }, GUN)))?.message).toContain('bulunamadı')
    expect((await hata(topluDilimOnizle('g1', { atamaIdleri: ['a1'], dilimIdleri: [] }, GUN)))?.message).toContain('En az bir sefer dilimi')
    expect((await hata(topluDilimOnizle('g1', { atamaIdleri: ['a1', 'yok'], dilimIdleri: ['d1'] }, GUN)))?.message).toContain('bulunamadı')
  })

  it('limit sabiti 200 (istemci sabitiyle eşit)', async () => {
    const { TOPLU_DILIM_ATAMA_LIMITI: istemci } = await import('../../app/(dashboard)/servis-yonetimi/guzergah/[id]/atama-dilim-sabitleri')
    expect(istemci).toBe(TOPLU_DILIM_ATAMA_LIMITI)
  })
})

describe('topluDilimAta — tek transaction, ayrı tarihçe, ortak topluIslemId', () => {
  it('normal: dilim eklenir, her atama için AYRI PERSONEL_ATAMA_DILIM tarihçesi (önceki/sonraki + kodlar), ortak topluIslemId', async () => {
    kur([atama('a1'), atama('a2', ['d2']), atama('a3', ['d1'])])
    const s = await topluDilimAta('g1', { atamaIdleri: ['a1', 'a2', 'a3'], dilimIdleri: ['d1'] }, 'u1', GUN)
    expect(s).toMatchObject({ degisen: 2, degismeyen: 1 })
    expect(dilimlerOf('a1')).toEqual(['d1'])
    expect(dilimlerOf('a2')).toEqual(['d1', 'd2'])
    expect(dilimlerOf('a3')).toEqual(['d1']) // değişmedi
    const g = gecmis()
    expect(g).toHaveLength(2) // değişmeyene tarihçe yok
    expect(g.map((x) => x.hedefId).sort()).toEqual(['a1', 'a2'])
    expect(g.every((x) => x.hedefTipi === 'PERSONEL_ATAMA_DILIM' && x.islem === 'GUNCELLEME' && x.userId === 'u1')).toBe(true)
    const a2 = g.find((x) => x.hedefId === 'a2')!
    expect(a2.oncekiDeger).toEqual({ dilimIdleri: ['d2'], dilimKodlari: ['AKŞAM_DÖNÜŞ'] })
    expect(a2.yeniDeger).toMatchObject({ dilimIdleri: ['d2', 'd1'], dilimKodlari: ['AKŞAM_DÖNÜŞ', 'SABAH_GIDIŞ'] })
    // ortak topluIslemId
    const idler = new Set(g.map((x) => x.yeniDeger.topluIslemId))
    expect(idler.size).toBe(1)
    expect([...idler][0]).toBe(s.topluIslemId)
    expect(g[0].aciklama).toBe('Toplu dilim atama (2 atama)')
  })

  it('🔴 aşım: onay YOK → ASIM_ONAYI_GEREKLI (hiçbir şey yazılmaz); onay VAR → uygulanır', async () => {
    kur([atama('a1'), atama('a2'), atama('a3')]) // d1: 8 + 3 = 11 > 10
    const e = await topluDilimAta('g1', { atamaIdleri: ['a1', 'a2', 'a3'], dilimIdleri: ['d1'] }, 'u1', GUN).catch((x: AtamaDilimHatasi) => x)
    expect(e).toBeInstanceOf(AtamaDilimHatasi)
    expect((e as AtamaDilimHatasi).kod).toBe('ASIM_ONAYI_GEREKLI')
    expect(((e as AtamaDilimHatasi).ayrinti as { etki: { fazla: number }[] }).etki[0].fazla).toBe(1)
    expect(dilimlerOf('a1')).toEqual([])
    expect(gecmis()).toHaveLength(0)

    const s = await topluDilimAta('g1', { atamaIdleri: ['a1', 'a2', 'a3'], dilimIdleri: ['d1'], asimOnayi: true }, 'u1', GUN)
    expect(s.degisen).toBe(3)
    expect(dilimlerOf('a3')).toEqual(['d1'])
  })

  it('🔴 hepsi ya da hiçbiri: ikinci atama işlem sırasında kapatılırsa ilk atamanın dilimi de GERİ ALINIR, tarihçe yazılmaz', async () => {
    kur([atama('a1'), atama('a2')])
    db.txteKapat = 'a2'
    await expect(topluDilimAta('g1', { atamaIdleri: ['a1', 'a2'], dilimIdleri: ['d1'] }, 'u1', GUN)).rejects.toThrow('kapatıldı')
    expect(dilimlerOf('a1')).toEqual([])
    expect(dilimlerOf('a2')).toEqual([])
    expect(gecmis()).toHaveLength(0)
  })

  it('🔴 audit fail-closed: tarihçe yazılamazsa dilim bağlantıları da yazılmaz', async () => {
    kur([atama('a1'), atama('a2')])
    db.gecmisYazilamaz = true
    await expect(topluDilimAta('g1', { atamaIdleri: ['a1', 'a2'], dilimIdleri: ['d1'] }, 'u1', GUN)).rejects.toThrow('audit')
    expect(dilimlerOf('a1')).toEqual([])
    expect(dilimlerOf('a2')).toEqual([])
  })

  it('hepsinde zaten var → "değişiklik yok" hatası, tarihçe yok', async () => {
    kur([atama('a1', ['d1'])])
    await expect(topluDilimAta('g1', { atamaIdleri: ['a1'], dilimIdleri: ['d1'] }, 'u1', GUN)).rejects.toThrow('değişiklik yok')
    expect(gecmis()).toHaveLength(0)
  })

  it('tekrarlı çağrı (idempotent): ikinci uygulama yeni dilim satırı/tarihçe üretmez', async () => {
    kur([atama('a1')])
    await topluDilimAta('g1', { atamaIdleri: ['a1'], dilimIdleri: ['d2'] }, 'u1', GUN)
    await expect(topluDilimAta('g1', { atamaIdleri: ['a1'], dilimIdleri: ['d2'] }, 'u1', GUN)).rejects.toThrow('zaten var')
    expect(gecmis()).toHaveLength(1)
    expect(dilimlerOf('a1')).toEqual(['d2'])
  })
})

describe('atamaDilimleriniGuncelle — tek atama (ekle/çıkar)', () => {
  it('ekle: dilim bağlanır, tarihçede önceki/sonraki liste (topluIslemId yok)', async () => {
    kur([atama('a1', ['d2'])])
    const s = await atamaDilimleriniGuncelle('a1', { ekle: ['d1'] }, 'u1', GUN)
    expect(s.sonraki).toEqual(['d2', 'd1'])
    expect(dilimlerOf('a1')).toEqual(['d1', 'd2'])
    expect(gecmis()[0]).toMatchObject({ hedefTipi: 'PERSONEL_ATAMA_DILIM', islem: 'GUNCELLEME', aciklama: 'Dilim düzenleme' })
    expect(gecmis()[0].yeniDeger.topluIslemId).toBeUndefined()
  })

  it('çıkar: bağlantı kalkar ama ÖNCEKİ liste tarihçede kalır (izlenebilir / geri dönüş)', async () => {
    kur([atama('a1', ['d1', 'd2'])])
    await atamaDilimleriniGuncelle('a1', { cikar: ['d2'] }, 'u1', GUN)
    expect(dilimlerOf('a1')).toEqual(['d1'])
    expect(gecmis()[0].oncekiDeger).toEqual({ dilimIdleri: ['d1', 'd2'], dilimKodlari: ['SABAH_GIDIŞ', 'AKŞAM_DÖNÜŞ'] })
    // tarihçedeki önceki listeyle geri alma: yeniden ekle
    await atamaDilimleriniGuncelle('a1', { ekle: ['d2'] }, 'u1', GUN)
    expect(dilimlerOf('a1')).toEqual(['d1', 'd2'])
  })

  it('🔴 hiç dilim kalacaksa DILIMSIZ_ONAYI_GEREKLI; onayla → dilimsiz kalır', async () => {
    kur([atama('a1', ['d1'])])
    const e = await atamaDilimleriniGuncelle('a1', { cikar: ['d1'] }, 'u1', GUN).catch((x: AtamaDilimHatasi) => x)
    expect((e as AtamaDilimHatasi).kod).toBe('DILIMSIZ_ONAYI_GEREKLI')
    expect(dilimlerOf('a1')).toEqual(['d1'])
    expect(gecmis()).toHaveLength(0)
    await atamaDilimleriniGuncelle('a1', { cikar: ['d1'], dilimsizOnayi: true }, 'u1', GUN)
    expect(dilimlerOf('a1')).toEqual([])
    expect(gecmis()[0].yeniDeger).toMatchObject({ dilimIdleri: [], dilimKodlari: [] })
  })

  it('🔴 aşım: ekleme kapasiteyi aşacaksa ASIM_ONAYI_GEREKLI, onayla → uygulanır', async () => {
    db.kapasite.d1 = { atananPersonelSayisi: 10, kapasite: 10, durum: 'UYGUN' } // tam dolu
    kur([atama('a1')])
    const e = await atamaDilimleriniGuncelle('a1', { ekle: ['d1'] }, 'u1', GUN).catch((x: AtamaDilimHatasi) => x)
    expect((e as AtamaDilimHatasi).kod).toBe('ASIM_ONAYI_GEREKLI')
    await atamaDilimleriniGuncelle('a1', { ekle: ['d1'], asimOnayi: true }, 'u1', GUN)
    expect(dilimlerOf('a1')).toEqual(['d1'])
  })

  it('çıkarma aşım uyarısı VERMEZ (aşımda olan dilimden çıkarmak serbest)', async () => {
    db.kapasite.d1 = { atananPersonelSayisi: 12, kapasite: 10, durum: 'ASIM' }
    kur([atama('a1', ['d1', 'd2'])])
    await expect(atamaDilimleriniGuncelle('a1', { cikar: ['d1'] }, 'u1', GUN)).resolves.toBeTruthy()
  })

  it('🔴 kullanıcı hataları: değişiklik yok, ekle∩çıkar, pasif atama, pasif dilim, zaten bağlıyı ekleme', async () => {
    kur([atama('a1', ['d1']), atama('p1', [], { aktif: false })])
    const mesaj = (p: Promise<unknown>) => p.then(() => 'OK', (e: Error) => e.message)
    expect(await mesaj(atamaDilimleriniGuncelle('a1', {}, 'u1', GUN))).toBe('Değişiklik yok.')
    expect(await mesaj(atamaDilimleriniGuncelle('a1', { ekle: ['d1'] }, 'u1', GUN))).toBe('Değişiklik yok.')
    expect(await mesaj(atamaDilimleriniGuncelle('a1', { ekle: ['d2'], cikar: ['d2'] }, 'u1', GUN))).toContain('hem eklenip hem çıkarılamaz')
    expect(await mesaj(atamaDilimleriniGuncelle('p1', { ekle: ['d1'] }, 'u1', GUN))).toContain('Pasif atamaya')
    expect(await mesaj(atamaDilimleriniGuncelle('a1', { ekle: ['d3'] }, 'u1', GUN))).toContain('pasif')
    expect(await mesaj(atamaDilimleriniGuncelle('yok', { ekle: ['d1'] }, 'u1', GUN))).toContain('bulunamadı')
    expect(gecmis()).toHaveLength(0)
  })

  it('sonradan değişiklik: pasif bir dilimle bağlı atamada o bağlantı KORUNUR (yalnız seçilen çıkarılır)', async () => {
    kur([atama('a1', ['d3'])]) // d3 pasif dilim
    await atamaDilimleriniGuncelle('a1', { ekle: ['d1'] }, 'u1', GUN)
    expect(dilimlerOf('a1')).toEqual(['d1', 'd3'])
  })
})

describe('C5-3 — toplu Dilim Ata: transaction içi sorgu bütçesi (200 atama)', () => {
  it(`dilim EKLEME: atama başına 3 sorgu (findUnique + createMany + tarihçe) → ${TOPLU_DILIM_ATAMA_LIMITI} atama = ${3 * TOPLU_DILIM_ATAMA_LIMITI}`, async () => {
    const N = TOPLU_DILIM_ATAMA_LIMITI
    kur(Array.from({ length: N }, (_, i) => atama(`t${i}`)))
    const s = await topluDilimAta('g1', { atamaIdleri: Array.from({ length: N }, (_, i) => `t${i}`), dilimIdleri: ['d2'] }, 'u1', GUN)
    expect(s.degisen).toBe(N)
    expect(db.txSorgu).toBe(3 * N)
  })

  it('dilim ÇIKARMA/DÜZENLEME tek atamada: findUnique + deleteMany + createMany + tarihçe = 4', async () => {
    kur([atama('a1', ['d1'])])
    await atamaDilimleriniGuncelle('a1', { ekle: ['d2'], cikar: ['d1'] }, 'u1', GUN)
    expect(db.txSorgu).toBe(4)
  })
})
