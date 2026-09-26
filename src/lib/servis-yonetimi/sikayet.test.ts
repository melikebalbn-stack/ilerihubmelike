import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  aracFindUnique: vi.fn(),
  soforFindUnique: vi.fn(),
  firmaFindUnique: vi.fn(),
  sorumluFindFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    $executeRaw: mocks.executeRaw,
    $queryRaw: mocks.queryRaw,
    servisSikayet: { create: mocks.create, findMany: mocks.findMany },
    servisArac: { findUnique: mocks.aracFindUnique },
    servisSofor: { findUnique: mocks.soforFindUnique },
    servisFirma: { findUnique: mocks.firmaFindUnique },
    servisSorumlusu: { findFirst: mocks.sorumluFindFirst },
  },
}))

import {
  sikayetOlustur,
  sonrakiSikayetNo,
  sikayetWhereOlustur,
  sikayetListesiGetir,
  sikayetFirmaListesiGetir,
  FIRMA_GORUNUMU_SELECT,
  SikayetError,
  type SikayetOlusturGirdisi,
} from './sikayet'

const OLAY = new Date('2026-09-20T00:00:00.000Z')
const BILDIRIM = new Date('2026-09-22T00:00:00.000Z')

/**
 * $transaction'a verilen tx client. Çağrı SIRASINI ve HANGİ client'ın
 * kullanıldığını izleyebilmek için her çağrı `cagriIzi`ye yazılıyor.
 */
function txClientKur(cagriIzi: string[], sonrakiNo = 1) {
  const tx = {
    __kimlik: 'TX_CLIENT',
    $executeRaw: vi.fn(async () => { cagriIzi.push('tx.$executeRaw(advisory_lock)'); return 1 }),
    $queryRaw: vi.fn(async () => { cagriIzi.push('tx.$queryRaw(MAX_no)'); return [{ next: BigInt(sonrakiNo) }] }),
    servisSikayet: { create: vi.fn(async (a: unknown) => { cagriIzi.push('tx.servisSikayet.create'); return { id: 's1', ...(a as { data: object }).data } }) },
    servisArac: { findUnique: vi.fn(async () => ({ plaka: '41 AB 1' })) },
    servisSofor: { findUnique: vi.fn(async () => ({ adSoyad: 'Mehmet Şoför' })) },
    servisFirma: { findUnique: vi.fn(async () => ({ ad: 'Firma A' })) },
    servisSorumlusu: { findFirst: vi.fn(async () => ({ personnel: { adSoyad: 'Ayşe Sorumlu' } })) },
  }
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
  return tx
}

const GIRDI: SikayetOlusturGirdisi = {
  tarih: OLAY,
  bildirimTarihi: BILDIRIM,
  kategori: 'GEC_GELME',
  aciklama: '  Servis 20 dakika geç geldi.  ',
  guzergahId: 'g1',
  kaynak: 'IV',
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
})

// ----------------------------------------------------------------------------
// 🔴 EŞZAMANLILIK — desenin tek kırılma noktası
// ----------------------------------------------------------------------------
describe('sikayetOlustur — numara üretimi ve insert AYNI transaction', () => {
  it('🔴 advisory lock, MAX sorgusundan ÖNCE alınır', async () => {
    const iz: string[] = []
    txClientKur(iz)
    await sikayetOlustur(GIRDI)

    const lockIdx = iz.indexOf('tx.$executeRaw(advisory_lock)')
    const maxIdx = iz.indexOf('tx.$queryRaw(MAX_no)')
    expect(lockIdx).toBeGreaterThanOrEqual(0)
    expect(maxIdx).toBeGreaterThanOrEqual(0)
    expect(lockIdx).toBeLessThan(maxIdx)
  })

  it('🔴 numara üretimi ve INSERT AYNI tx client üzerinde — modül seviyesindeki prisma HİÇ kullanılmıyor', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur(GIRDI)

    // Üçü de aynı tx client'ta
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.servisSikayet.create).toHaveBeenCalledTimes(1)

    // 🔴 Kritik: transaction DIŞINDAKİ prisma'ya hiç dokunulmadı. Dokunulsaydı
    // advisory lock erken serbest kalır ve yarış geri gelirdi.
    expect(mocks.executeRaw).not.toHaveBeenCalled()
    expect(mocks.queryRaw).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()

    // Tek bir transaction açıldı, iç içe değil
    expect(mocks.transaction).toHaveBeenCalledTimes(1)

    // Sıra: kilit → MAX → create, hepsi tx üzerinde
    expect(iz).toEqual([
      'tx.$executeRaw(advisory_lock)',
      'tx.$queryRaw(MAX_no)',
      'tx.servisSikayet.create',
    ])
  })

  it('ardışık iki üretim numara ATLAMAZ (N, N+1)', async () => {
    const iz: string[] = []
    txClientKur(iz, 7)
    const a = await sikayetOlustur(GIRDI)
    expect((a as { no: number }).no).toBe(7)

    txClientKur(iz, 8)
    const b = await sikayetOlustur(GIRDI)
    expect((b as { no: number }).no).toBe(8)
  })

  it('sonrakiSikayetNo tx verilmezse KENDİ transaction\'ını açar (tek başına da güvenli)', async () => {
    const iz: string[] = []
    txClientKur(iz, 42)
    const no = await sonrakiSikayetNo()
    expect(no).toBe(42)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })

  it('tx verildiğinde YENİ transaction AÇMAZ (iç içe transaction yok)', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz, 5)
    mocks.transaction.mockClear()

    const no = await sonrakiSikayetNo(tx as never)
    expect(no).toBe(5)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('kilit adı servis_sikayet_no, seri 0 tabanlı ve tablo servis_sikayet', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur(GIRDI)

    const lockSql = (tx.$executeRaw.mock.calls[0][0] as unknown as string[]).join('?')
    expect(lockSql).toContain('pg_advisory_xact_lock')
    expect(lockSql).toContain('servis_sikayet_no')

    const maxSql = (tx.$queryRaw.mock.calls[0][0] as unknown as string[]).join('?')
    expect(maxSql).toContain('COALESCE(MAX("no"), 0) + 1')
    expect(maxSql).toContain('"servis_sikayet"')
    // Yıl bazlı seri YOK
    expect(maxSql).not.toMatch(/EXTRACT|YEAR|yil/i)
  })
})

// ----------------------------------------------------------------------------
// Oluşturma kuralları
// ----------------------------------------------------------------------------
describe('sikayetOlustur — kurallar', () => {
  it('durum HER ZAMAN ACIK ile başlar', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur(GIRDI)
    expect(tx.servisSikayet.create.mock.calls[0][0].data.durum).toBe('ACIK')
  })

  it('guzergahId boşsa yol gösteren hata, transaction hiç açılmaz', async () => {
    await expect(sikayetOlustur({ ...GIRDI, guzergahId: '  ' })).rejects.toThrow(SikayetError)
    await expect(sikayetOlustur({ ...GIRDI, guzergahId: '' })).rejects.toThrow('güzergâha ait olduğunu seçin')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('kaynak verilmezse reddedilir (default YOK)', async () => {
    await expect(
      sikayetOlustur({ ...GIRDI, kaynak: undefined as never }),
    ).rejects.toThrow('kaynak')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('aciklama boşsa reddedilir ve dolu olduğunda kırpılır', async () => {
    await expect(sikayetOlustur({ ...GIRDI, aciklama: '   ' })).rejects.toThrow('Açıklama')

    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur(GIRDI)
    expect(tx.servisSikayet.create.mock.calls[0][0].data.aciklama).toBe('Servis 20 dakika geç geldi.')
  })

  it('bildirimTarihi ve tarih AYRI alanlar olarak yazılır (karıştırılmıyor)', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur(GIRDI)
    const d = tx.servisSikayet.create.mock.calls[0][0].data
    expect(d.tarih).toBe(OLAY)
    expect(d.bildirimTarihi).toBe(BILDIRIM)
  })
})

// ----------------------------------------------------------------------------
// Anlık kopya
// ----------------------------------------------------------------------------
describe('sikayetOlustur — anlık kopya (delil)', () => {
  it('verilen id\'lerden plaka/şoför/firma doldurulur', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, aracId: 'a1', soforId: 's1', firmaId: 'f1' })

    const d = tx.servisSikayet.create.mock.calls[0][0].data
    expect(d.plaka).toBe('41 AB 1')
    expect(d.soforAdSoyad).toBe('Mehmet Şoför')
    expect(d.firmaAd).toBe('Firma A')
  })

  it('🔴 firmaId YOKSA firmaAd BOŞ kalır — araç üzerinden ÇIKARIM YAPILMAZ', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, aracId: 'a1' }) // firmaId verilmedi

    const d = tx.servisSikayet.create.mock.calls[0][0].data
    expect(d.plaka).toBe('41 AB 1')
    expect(d.firmaAd).toBeNull()
    // Firma hiç sorgulanmadı bile
    expect(tx.servisFirma.findUnique).not.toHaveBeenCalled()
  })

  it('🔴 sorumluAdSoyad OLAY TARİHİNE göre seçilir; aktif bayrağı KULLANILMAZ', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur(GIRDI)

    const where = tx.servisSorumlusu.findFirst.mock.calls[0][0].where
    expect(where.guzergahId).toBe('g1')
    expect(where.rol).toBe('ANA')
    // Ders 73: aktif bayrağına dayanmıyor
    expect(where.aktif).toBeUndefined()
    // Ders 59: POZİTİF AND-of-OR — olay tarihi (bugün değil)
    expect(where.baslangicTarihi).toEqual({ lte: OLAY })
    expect(where.OR).toEqual([{ bitisTarihi: null }, { bitisTarihi: { gte: OLAY } }])
    // NOT/negatif form kullanılmamış
    expect(where.NOT).toBeUndefined()
  })

  it('o tarihte sorumlu yoksa alan boş kalır, kayıt yine oluşur', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    tx.servisSorumlusu.findFirst.mockResolvedValue(null)

    await sikayetOlustur(GIRDI)
    expect(tx.servisSikayet.create.mock.calls[0][0].data.sorumluAdSoyad).toBeNull()
  })

  it('🔴 planlananSaat ÇAĞIRANDAN gelir, türetilmez', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, planlananSaat: '07:15' })
    expect(tx.servisSikayet.create.mock.calls[0][0].data.planlananSaat).toBe('07:15')

    const iz2: string[] = []
    const tx2 = txClientKur(iz2)
    await sikayetOlustur(GIRDI)
    expect(tx2.servisSikayet.create.mock.calls[0][0].data.planlananSaat).toBeNull()
  })
})

// ----------------------------------------------------------------------------
// Filtreler
// ----------------------------------------------------------------------------
describe('sikayetWhereOlustur', () => {
  it('boş filtre boş where üretir', () => {
    expect(sikayetWhereOlustur({})).toEqual({})
  })

  it('altı filtre de where\'e yansır', () => {
    const w = sikayetWhereOlustur({
      guzergahId: 'g1', firmaId: 'f1', durum: 'ACIK', kategori: 'TEMIZLIK', kaynak: 'PERSONEL',
      bildirimBaslangic: OLAY, bildirimBitis: BILDIRIM,
    })
    expect(w.guzergahId).toBe('g1')
    expect(w.firmaId).toBe('f1')
    expect(w.durum).toBe('ACIK')
    expect(w.kategori).toBe('TEMIZLIK')
    expect(w.kaynak).toBe('PERSONEL')
    expect(w.bildirimTarihi).toEqual({ gte: OLAY, lte: BILDIRIM })
  })

  it('🔴 tarih filtresi bildirimTarihi ÜZERİNDEN — olay tarihi (tarih) filtrelenmiyor', () => {
    const w = sikayetWhereOlustur({ bildirimBaslangic: OLAY })
    expect(w.bildirimTarihi).toEqual({ gte: OLAY })
    expect(w.tarih).toBeUndefined()
  })

  it('tek uçlu aralık desteklenir', () => {
    expect(sikayetWhereOlustur({ bildirimBitis: BILDIRIM }).bildirimTarihi).toEqual({ lte: BILDIRIM })
  })
})

// ----------------------------------------------------------------------------
// 🔴 KVKK — iki ayrı çıktı şekli
// ----------------------------------------------------------------------------
describe('KVKK — firma görünümü şikâyetçiyi HİÇ SEÇMEZ', () => {
  it('🔴 firma görünümünün prisma select\'inde şikâyetçi alanları BULUNMUYOR', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetFirmaListesiGetir({ firmaId: 'f1' })

    const select = mocks.findMany.mock.calls[0][0].select
    const anahtarlar = Object.keys(select)

    // Maskeleme değil — alan select'te HİÇ YOK
    expect(anahtarlar).not.toContain('sikayetciPersonnelId')
    expect(anahtarlar).not.toContain('sikayetci')
    expect(select.sikayetciPersonnelId).toBeUndefined()
    expect(select.sikayetci).toBeUndefined()

    // "sikayetci" geçen HİÇBİR anahtar olmasın
    expect(anahtarlar.filter(k => /sikayetci/i.test(k))).toEqual([])
  })

  it('firma görünümü dışa açık sabitle AYNI select\'i kullanır (denetlenebilir)', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetFirmaListesiGetir()
    expect(mocks.findMany.mock.calls[0][0].select).toEqual({ ...FIRMA_GORUNUMU_SELECT })
    expect(Object.keys(FIRMA_GORUNUMU_SELECT).filter(k => /sikayetci/i.test(k))).toEqual([])
  })

  it('iç görünüm şikâyetçiyi DAHİL eder — iki görünüm gerçekten farklı', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetListesiGetir()

    const select = mocks.findMany.mock.calls[0][0].select
    expect(select.sikayetciPersonnelId).toBe(true)
    expect(select.sikayetci).toBeTruthy()
  })

  it('iç görünümde Personnel select\'i id/sicilNo/adSoyad/bolum ile SINIRLI (telefon/adres/e-posta yok)', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetListesiGetir()

    const select = mocks.findMany.mock.calls[0][0].select
    for (const alan of ['sikayetci', 'sorumlu'] as const) {
      expect(Object.keys(select[alan].select).sort()).toEqual(['adSoyad', 'bolum', 'id', 'sicilNo'])
    }
  })

  it('iki görünüm AYNI where\'i kullanır — firma görünümü ekstra kayıt görmüyor', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetListesiGetir({ durum: 'KAPANDI' })
    const icWhere = mocks.findMany.mock.calls[0][0].where

    mocks.findMany.mockClear()
    await sikayetFirmaListesiGetir({ durum: 'KAPANDI' })
    expect(mocks.findMany.mock.calls[0][0].where).toEqual(icWhere)
  })

  it('her iki görünüm de bildirimTarihi desc + no desc sıralar', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetListesiGetir()
    expect(mocks.findMany.mock.calls[0][0].orderBy).toEqual([{ bildirimTarihi: 'desc' }, { no: 'desc' }])

    mocks.findMany.mockClear()
    await sikayetFirmaListesiGetir()
    expect(mocks.findMany.mock.calls[0][0].orderBy).toEqual([{ bildirimTarihi: 'desc' }, { no: 'desc' }])
  })
})

// ----------------------------------------------------------------------------
// Adım 2B — durakId (alan main'e girdi)
// ----------------------------------------------------------------------------
describe('durakId — oluşturma', () => {
  it('durakId VERİLİNCE yazılır', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, durakId: 'd1' })
    expect(tx.servisSikayet.create.mock.calls[0][0].data.durakId).toBe('d1')
  })

  it('durakId VERİLMEYİNCE null yazılır', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur(GIRDI)
    expect(tx.servisSikayet.create.mock.calls[0][0].data.durakId).toBeNull()
  })

  it('🔴 durakId GELSE BİLE planlananSaat otomatik DOLDURULMAZ', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, durakId: 'd1', dilimId: 'dil1' })

    const d = tx.servisSikayet.create.mock.calls[0][0].data
    expect(d.durakId).toBe('d1')
    expect(d.planlananSaat).toBeNull()
    // Saat tablosuna hiç sorgu atılmadı
    expect((tx as unknown as Record<string, unknown>).servisGuzergahDurakSaat).toBeUndefined()
  })

  it('durakId verilse de çağıranın planlananSaat\'i korunur', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, durakId: 'd1', planlananSaat: '07:15' })
    expect(tx.servisSikayet.create.mock.calls[0][0].data.planlananSaat).toBe('07:15')
  })
})

describe('durakId — filtre', () => {
  it('where\'e girer', () => {
    expect(sikayetWhereOlustur({ durakId: 'd1' }).durakId).toBe('d1')
  })

  it('verilmezse where\'de yok', () => {
    expect(sikayetWhereOlustur({}).durakId).toBeUndefined()
  })

  it('İÇ görünümde filtre where\'e doğru iletilir', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetListesiGetir({ durakId: 'd1' })
    expect(mocks.findMany.mock.calls[0][0].where.durakId).toBe('d1')
  })

  it('FİRMA görünümünde de filtre where\'e doğru iletilir', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetFirmaListesiGetir({ durakId: 'd1' })
    expect(mocks.findMany.mock.calls[0][0].where.durakId).toBe('d1')
  })
})

describe('durakId — select kapsamı (madde 23)', () => {
  /** Durak select'inin alan adlarını döndürür. */
  function durakAlanlari(select: Record<string, unknown>): string[] {
    const durak = select.durak as { select: Record<string, unknown> } | undefined
    return durak ? Object.keys(durak.select) : []
  }

  for (const [etiket, cagir] of [
    ['iç görünüm', () => sikayetListesiGetir()],
    ['firma görünümü', () => sikayetFirmaListesiGetir()],
  ] as const) {
    it(`${etiket}: durak YALNIZ id/kod/ad — konum alanları desen taramasıyla YOK`, async () => {
      mocks.findMany.mockResolvedValue([])
      await cagir()

      const alanlar = durakAlanlari(mocks.findMany.mock.calls[0][0].select)
      expect(alanlar.sort()).toEqual(['ad', 'id', 'kod'])
      // Tek tek saymak yerine desen: konum/koordinat sızıntısı yakalanır
      expect(alanlar.filter(a => /il|ilce|mahalle|enlem|boylam|adres|koordinat/i.test(a))).toEqual([])
    })
  }

  it('durakId ham alan olarak her iki görünümde de var', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetListesiGetir()
    expect(mocks.findMany.mock.calls[0][0].select.durakId).toBe(true)

    mocks.findMany.mockClear()
    await sikayetFirmaListesiGetir()
    expect(mocks.findMany.mock.calls[0][0].select.durakId).toBe(true)
  })
})

describe('durakId — KVKK regresyonu', () => {
  it('🔴 firma görünümünün select\'i HÂLÂ /sikayetci/i desenini içermiyor', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetFirmaListesiGetir({ durakId: 'd1' })

    const select = mocks.findMany.mock.calls[0][0].select
    expect(Object.keys(select).filter(k => /sikayetci/i.test(k))).toEqual([])
    expect(Object.keys(FIRMA_GORUNUMU_SELECT).filter(k => /sikayetci/i.test(k))).toEqual([])
  })
})

// ----------------------------------------------------------------------------
// Melih kararı (25.09.2026): şikâyetçi zorunluluğu KAYNAĞA bağlı.
// PERSONEL → zorunlu · IV → opsiyonel (ama verilebilir).
// ----------------------------------------------------------------------------
describe('şikâyetçi zorunluluğu — kaynağa bağlı', () => {
  it('🔴 kaynak=PERSONEL + şikâyetçi YOK → reddedilir, mesaj YOL GÖSTERİR', async () => {
    await expect(
      sikayetOlustur({ ...GIRDI, kaynak: 'PERSONEL' }),
    ).rejects.toThrow(/şikâyetçiyi seçin/)

    // Yol gösteriyor: ne yapılacağını söylüyor
    await expect(
      sikayetOlustur({ ...GIRDI, kaynak: 'PERSONEL' }),
    ).rejects.toThrow(/kaynağı "İV" olarak işaretleyin/)

    // Hiçbir yazma olmadı
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('kaynak=PERSONEL + yalnız boşluk da YETMEZ', async () => {
    await expect(
      sikayetOlustur({ ...GIRDI, kaynak: 'PERSONEL', sikayetciPersonnelId: '   ' }),
    ).rejects.toThrow(/şikâyetçiyi seçin/)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('kaynak=PERSONEL + şikâyetçi VAR → kabul', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, kaynak: 'PERSONEL', sikayetciPersonnelId: 'p1' })
    const d = tx.servisSikayet.create.mock.calls[0][0].data
    expect(d.kaynak).toBe('PERSONEL')
    expect(d.sikayetciPersonnelId).toBe('p1')
  })

  it('kaynak=IV + şikâyetçi YOK → KABUL (İV gözlemi / isimsiz bildirim)', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, kaynak: 'IV' })
    const d = tx.servisSikayet.create.mock.calls[0][0].data
    expect(d.kaynak).toBe('IV')
    expect(d.sikayetciPersonnelId).toBeNull()
  })

  it('kaynak=IV + şikâyetçi VAR → KABUL (İV ismi biliyorsa yazabilmeli)', async () => {
    const iz: string[] = []
    const tx = txClientKur(iz)
    await sikayetOlustur({ ...GIRDI, kaynak: 'IV', sikayetciPersonnelId: 'p7' })
    expect(tx.servisSikayet.create.mock.calls[0][0].data.sikayetciPersonnelId).toBe('p7')
  })
})

// ----------------------------------------------------------------------------
// Adım 5F — güzergâh KOD/AD ortak select'te
// ----------------------------------------------------------------------------
describe('guzergah — select kapsamı (Adım 5F)', () => {
  function guzergahAlanlari(select: Record<string, unknown>): string[] {
    const g = select.guzergah as { select: Record<string, unknown> } | undefined
    return g ? Object.keys(g.select) : []
  }

  for (const [etiket, cagir] of [
    ['iç görünüm', () => sikayetListesiGetir()],
    ['firma görünümü', () => sikayetFirmaListesiGetir()],
  ] as const) {
    it(`${etiket}: guzergah YALNIZ kod/ad seçiliyor`, async () => {
      mocks.findMany.mockResolvedValue([])
      await cagir()
      expect(guzergahAlanlari(mocks.findMany.mock.calls[0][0].select).sort()).toEqual(['ad', 'kod'])
    })
  }

  it('🔴 İKİ GÖRÜNÜM AYRIŞMIYOR: guzergah her ikisinde de AYNI şekilde var', async () => {
    // ORTAK_SELECT'e konuldu; birine eklenip diğerine eklenmeme durumu
    // (ekranla dosyanın farklı kolon taşıması) bu testle kapalı.
    mocks.findMany.mockResolvedValue([])
    await sikayetListesiGetir()
    const ic = mocks.findMany.mock.calls[0][0].select.guzergah

    mocks.findMany.mockClear()
    await sikayetFirmaListesiGetir()
    const firma = mocks.findMany.mock.calls[0][0].select.guzergah

    expect(firma).toEqual(ic)
    expect(firma).toEqual({ select: { kod: true, ad: true } })
  })

  it('ham guzergahId HÂLÂ her iki görünümde de var (ilişki onu değiştirmedi)', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetListesiGetir()
    expect(mocks.findMany.mock.calls[0][0].select.guzergahId).toBe(true)

    mocks.findMany.mockClear()
    await sikayetFirmaListesiGetir()
    expect(mocks.findMany.mock.calls[0][0].select.guzergahId).toBe(true)
  })

  it('🔴 REGRESYON: guzergah eklendikten sonra da firma select\'inde şikâyetçi YOK', async () => {
    mocks.findMany.mockResolvedValue([])
    await sikayetFirmaListesiGetir()
    const select = mocks.findMany.mock.calls[0][0].select
    expect(Object.keys(select).filter(k => /sikayetci/i.test(k))).toEqual([])
    expect(select).toEqual({ ...FIRMA_GORUNUMU_SELECT })
  })
})
