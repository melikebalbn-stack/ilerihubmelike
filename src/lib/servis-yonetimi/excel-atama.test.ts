import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

// ============================================================================
// C2 — Excel'den toplu atama: okuma, planlama (saf), önizleme (yazmaz), uygulama (tek transaction).
// Servis kodu GERÇEK; DB bellek-içi sahte (transaction semantiği dahil: hata → hepsi geri alınır).
// ============================================================================

type Atama = { id: string; personnelId: string; guzergahId: string; durakId: string | null; baslangicTarihi: Date; bitisTarihi: Date | null; aktif: boolean; atamaKaynagi?: string; dilimler: { dilimId: string }[] }

const db = vi.hoisted(() => ({
  personeller: [] as { id: string; sicilNo: string; adSoyad: string; aktif: boolean }[],
  guzergahlar: [] as { id: string; kod: string; ad: string; aktif: boolean }[],
  dilimler: [] as { id: string; kod: string; ad: string; aktif: boolean }[],
  guzergahDuraklari: [] as { guzergahId: string; aktif: boolean; durakId: string; durak: { kod: string; aktif: boolean } }[],
  atamalar: new Map<string, unknown>(),
  gecmis: [] as unknown[],
  audit: [] as unknown[],
  seq: 0,
  auditYazilamaz: false,
  /** tx içinde bu atama okunurken kapatılır (yarış simülasyonu). */
  txteKapat: null as string | null,
  kapasite: {} as Record<string, { atananPersonelSayisi: number; kapasite: number; durum: string }>,
  yazmaSayaci: 0,
}))

vi.mock('@/lib/prisma', () => {
  const klon = <T,>(x: T): T => structuredClone(x)
  const A = (m: Map<string, unknown>, id: string) => m.get(id) as Atama | undefined
  const okuma = {
    personnel: { findMany: async ({ where }: { where: { sicilNo: { in: string[] } } }) => db.personeller.filter((p) => where.sicilNo.in.includes(p.sicilNo)).map((p) => ({ ...p })) },
    servisGuzergah: { findMany: async () => db.guzergahlar.map((g) => ({ ...g })) },
    servisSeferDilimi: { findMany: async () => db.dilimler.map((d) => ({ ...d })) },
    servisGuzergahDurak: { findMany: async ({ where }: { where: { guzergahId: { in: string[] } } }) => db.guzergahDuraklari.filter((g) => where.guzergahId.in.includes(g.guzergahId)).map((g) => klon(g)) },
  }
  const yazma = (atamalar: Map<string, unknown>, gecmis: unknown[], audit: unknown[]) => ({
    servisPersonelAtama: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (db.txteKapat === where.id) { const a = A(atamalar, where.id); if (a) a.aktif = false }
        const a = A(atamalar, where.id)
        return a ? klon(a) : null
      },
      findFirst: async ({ where }: { where: { personnelId: string } }) =>
        [...atamalar.values() as Iterable<Atama>].find((a) => a.personnelId === where.personnelId && a.aktif) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Atama> }) => { db.yazmaSayaci++; Object.assign(A(atamalar, where.id)!, data) },
      create: async ({ data }: { data: Omit<Atama, 'id' | 'dilimler' | 'aktif'> }) => {
        db.yazmaSayaci++
        const id = `yeni-${++db.seq}`
        atamalar.set(id, { ...data, id, aktif: true, dilimler: [] })
        return { id }
      },
    },
    servisPersonelAtamaDilim: {
      createMany: async ({ data }: { data: { atamaId: string; dilimId: string }[] }) => {
        db.yazmaSayaci++
        for (const d of data) A(atamalar, d.atamaId)!.dilimler.push({ dilimId: d.dilimId })
      },
    },
    servisIslemGecmisi: { create: async ({ data }: { data: unknown }) => { gecmis.push(klon(data)) } },
    __audit: audit,
  })
  return {
    prisma: {
      ...okuma,
      servisPersonelAtama: {
        findMany: async ({ where }: { where: { personnelId: { in: string[] } } }) =>
          [...db.atamalar.values() as Iterable<Atama>].filter((a) => where.personnelId.in.includes(a.personnelId) && a.aktif).map((a) => klon(a)),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const kopya = new Map<string, unknown>([...db.atamalar].map(([k, v]) => [k, klon(v)]))
        const gecmisK: unknown[] = []
        const auditK: unknown[] = []
        const sonuc = await fn(yazma(kopya, gecmisK, auditK))
        db.atamalar.clear()
        for (const [k, v] of kopya) db.atamalar.set(k, v)
        db.gecmis.push(...gecmisK)
        db.audit.push(...auditK)
        return sonuc
      },
    },
  }
})
vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: async (p: { tx: { __audit: unknown[] } }) => {
    if (db.auditYazilamaz) throw new Error('audit yazılamadı')
    p.tx.__audit.push(structuredClone({ ...p, tx: undefined }))
    return { ok: true }
  },
}))
vi.mock('./kapasite', () => ({ servisKapasiteOzetiGetir: async (_g: string, dilimId: string) => db.kapasite[dilimId] }))

import { GECIS_ORNEKLERI } from './atama-gecis.ornekler'
import {
  EXCEL_LIMITLERI, ExcelAtamaHatasi, HATA_RAPORU_BASLIKLARI, SABLON_BASLIKLARI, dilimKodlariniAyir, eklenenKisiHaritasi, excelOku,
  excelOnizle, excelUygula, hataRaporuOlustur, ozetle, sablonOlustur, satirlariPlanla, tarihHucresi,
  type HamSatir, type PlanBaglami,
} from './excel-atama'

const BUGUN = '2026-10-03'
const IZIN = { create: true, passive: true }

const D1 = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah Servisi', aktif: true }
const D2 = { id: 'd2', kod: 'AKŞAM_DÖNÜŞ', ad: 'Akşam Servisi', aktif: true }
const D3 = { id: 'd3', kod: 'ESKİ_DİLİM', ad: 'Eski', aktif: false }
const G1 = { id: 'g1', kod: 'DARICA', ad: 'Darıca', aktif: true }
const G2 = { id: 'g2', kod: 'ÜSKÜDAR', ad: 'Üsküdar-Zeynepkamil', aktif: true }
const G3 = { id: 'g3', kod: 'ESKİ_GÜZERGÂH', ad: 'Eski', aktif: false }

function xlsxOlustur(satirlar: unknown[][], baslik: unknown[] = [...SABLON_BASLIKLARI], ad = 'Atama'): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([baslik, ...satirlar], { cellDates: true }), ad)
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellDates: true }) as Buffer
}

const ham = (o: Partial<HamSatir> & { satirNo: number; sicil: string }): HamSatir => ({
  guzergahKod: '', durakKod: '', dilimKodlari: [], baslangic: '', ...o,
})

function baglam(o: Partial<PlanBaglami> = {}): PlanBaglami {
  const kodlu = <T extends { kod: string }>(l: T[]) => new Map(l.map((x) => [x.kod.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i'), x]))
  return {
    bugun: BUGUN,
    personel: new Map([
      ['101', { id: 'p1', adSoyad: 'Çağlar Şahin', aktif: true }],
      ['102', { id: 'p2', adSoyad: 'İlker Öztürk', aktif: true }],
      ['103', { id: 'p3', adSoyad: 'Ayşe Yıldız', aktif: false }],
    ]),
    aktifAtama: new Map(),
    gelecekAtama: new Set(),
    guzergah: kodlu([G1, G2, G3]) as PlanBaglami['guzergah'],
    durak: new Map([
      ['g1', new Map([['dk-01', { durakId: 'dk1', kod: 'DK-01', aktif: true }], ['dk-02', { durakId: 'dk2', kod: 'DK-02', aktif: false }]])],
      ['g2', new Map([['usk-01', { durakId: 'dk9', kod: 'USK-01', aktif: true }]])],
    ]),
    dilim: kodlu([D1, D2, D3]) as PlanBaglami['dilim'],
    izinler: IZIN,
    ...o,
  }
}
const MEVCUT = { id: 'a1', guzergahId: 'g1', guzergahKod: 'DARICA', durakId: 'dk1', baslangicTarihi: new Date('2026-09-27'), bitisTarihi: null as Date | null, dilimIdleri: ['d1'] }

describe('okuma', () => {
  it('şablon başlıklarıyla satırları okur; satır no = Excel satırı; boş satırlar atlanır; Türkçe sicil/kodlar korunur', () => {
    const buf = xlsxOlustur([
      ['101', 'DARICA', 'DK-01', 'SABAH_GIDIŞ, AKŞAM_DÖNÜŞ', '2026-10-01'],
      [null, null, null, null, null],
      [102, 'ÜSKÜDAR', 'USK-01', 'SABAH_GIDIŞ', '03.10.2026'],
    ])
    const s = excelOku(buf)
    expect(s).toHaveLength(2)
    expect(s[0]).toEqual({ satirNo: 2, sicil: '101', guzergahKod: 'DARICA', durakKod: 'DK-01', dilimKodlari: ['SABAH_GIDIŞ', 'AKŞAM_DÖNÜŞ'], baslangic: '2026-10-01' })
    expect(s[1]).toMatchObject({ satirNo: 4, sicil: '102', guzergahKod: 'ÜSKÜDAR', baslangic: '2026-10-03' }) // sayı hücresi sicil → '102', GG.AA.YYYY → ISO
  })

  it('başlıklar büyük harf / Türkçe karakterli / farklı biçimde de tanınır (İ/ı/Ş/Ğ/Ü/Ö/Ç)', () => {
    const buf = xlsxOlustur([['101', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01']], ['SİCİL NO', 'GÜZERGÂH KODU', 'DURAK KODU', 'SEFER DİLİMİ KODU(LARI)', 'BAŞLANGIÇ TARİHİ'])
    expect(excelOku(buf)[0]).toMatchObject({ sicil: '101', guzergahKod: 'DARICA', dilimKodlari: ['SABAH_GIDIŞ'] })
  })

  it('tarih biçimleri: Excel tarih hücresi, serial sayı, GG.AA.YYYY, GG/AA/YYYY, YYYY-AA-GG; çözülemeyen ham kalır', () => {
    expect(tarihHucresi(new Date(2026, 9, 3))).toBe('2026-10-03')
    expect(tarihHucresi(46298)).toBe('2026-10-03') // Excel serial
    expect(tarihHucresi('3.10.2026')).toBe('2026-10-03')
    expect(tarihHucresi('03/10/2026')).toBe('2026-10-03')
    expect(tarihHucresi('2026-10-3')).toBe('2026-10-03')
    expect(tarihHucresi('yarın')).toBe('yarın')
    expect(tarihHucresi(null)).toBe('')
  })

  it('Excel tarih hücresi (cellDates) gidiş-dönüş: yazılan gün okunur', () => {
    const buf = xlsxOlustur([['101', 'DARICA', '', 'SABAH_GIDIŞ', new Date(2026, 9, 3)]])
    expect(excelOku(buf)[0].baslangic).toBe('2026-10-03')
  })

  it('dilim ayırıcıları: virgül, noktalı virgül, satır sonu, "/" ve "+"; tekrarlar tekilleşir', () => {
    expect(dilimKodlariniAyir('A, B;C\nD / E + F, A')).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(dilimKodlariniAyir('')).toEqual([])
  })

  it('"Atama" sayfası yoksa ilk sayfa okunur', () => {
    expect(excelOku(xlsxOlustur([['101', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01']], [...SABLON_BASLIKLARI], 'Sayfa1'))).toHaveLength(1)
  })

  it('🔴 hatalar: boş dosya, .xlsx olmayan, başlık yok, eksik sütun, veri yok, satır sınırı, dosya boyutu', () => {
    const msj = (f: () => unknown) => { try { f(); return 'OK' } catch (e) { expect(e).toBeInstanceOf(ExcelAtamaHatasi); return (e as Error).message } }
    expect(msj(() => excelOku(Buffer.alloc(0)))).toContain('boş')
    expect(msj(() => excelOku(Buffer.from('Sicil;Guzergah\n101;DARICA')))).toContain('Yalnız .xlsx')
    expect(msj(() => excelOku(xlsxOlustur([], ['Ad', 'Soyad'])))).toContain('sütun(lar) bulunamadı')
    expect(msj(() => excelOku(xlsxOlustur([], [...SABLON_BASLIKLARI])))).toContain('veri satırı yok')
    const cok = Array.from({ length: EXCEL_LIMITLERI.maksSatir + 1 }, (_, i) => [`S${i}`, 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01'])
    expect(msj(() => excelOku(xlsxOlustur(cok)))).toContain(`En fazla ${EXCEL_LIMITLERI.maksSatir} satır`)
    expect(excelOku(xlsxOlustur(cok.slice(0, EXCEL_LIMITLERI.maksSatir)))).toHaveLength(EXCEL_LIMITLERI.maksSatir) // tam sınır geçer
    const dev = Buffer.concat([Buffer.from([0x50, 0x4b]), Buffer.alloc(EXCEL_LIMITLERI.maksDosyaBayt)])
    expect(msj(() => excelOku(dev))).toContain('çok büyük')
  })
})

describe('planlama — satır türleri', () => {
  const planla = (satirlar: HamSatir[], b = baglam()) => satirlariPlanla(satirlar, b)
  const tam = (o: Partial<HamSatir> = {}) => ham({ satirNo: 2, sicil: '101', guzergahKod: 'DARICA', durakKod: 'DK-01', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: '2026-10-01', ...o })

  it('YENİ: aktif atama yok → yeni atama; ad soyad yalnız plan sonucunda', () => {
    const [s] = planla([tam()])
    expect(s).toMatchObject({ tur: 'YENI', adSoyad: 'Çağlar Şahin', guzergahId: 'g1', durakId: 'dk1', dilimIdleri: ['d1'] })
  })

  it('🔴 Türkçe büyük/küçük harf ve ASCII yazım: "uskudar", "ÜSKÜDAR", "usk-01", "sabah_gidis", "akşam_dönüş" eşleşir', () => {
    const [a, b] = planla([
      tam({ satirNo: 2, sicil: '101', guzergahKod: 'uskudar', durakKod: 'usk-01', dilimKodlari: ['sabah_gidis', 'AKSAM_DONUS'] }),
      tam({ satirNo: 3, sicil: '102', guzergahKod: 'Üsküdar', durakKod: 'USK-01', dilimKodlari: ['sabah_gıdış'] }),
    ])
    expect(a).toMatchObject({ tur: 'YENI', guzergahId: 'g2', dilimIdleri: ['d1', 'd2'] })
    expect(b).toMatchObject({ tur: 'YENI', guzergahId: 'g2', dilimIdleri: ['d1'] })
  })

  it('durak boş → durak olmadan yeni atama', () => {
    expect(planla([tam({ durakKod: '' })])[0]).toMatchObject({ tur: 'YENI', durakId: null })
  })

  it('DEĞİŞİKLİK: aktif atama farklı güzergâh/durak → eski kapanır, yenisi açılır', () => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]) })
    // tarih 2026-10-01 (geçmiş): eski anında pasif, bitiş = geçiş günü
    expect(planla([tam({ guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01' })], b)[0]).toMatchObject({ tur: 'DEGISIKLIK', eskiAtamaId: 'a1', guzergahId: 'g2', durakId: 'dk9', eskiAktif: false, eskiBitis: '2026-10-01' })
    // aynı güzergâh, farklı durak da değişikliktir
    expect(planla([tam({ durakKod: 'DK-02' })], b)[0].hata).toContain('Durak pasif') // pasif durak seçilemez
  })

  it('aynı güzergâh+durak: eksik dilim varsa DILIM_EKLE, yoksa DEGISIKLIK_YOK; durak boşsa "durak değişmez"', () => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]) })
    expect(planla([tam({ dilimKodlari: ['SABAH_GIDIŞ', 'AKŞAM_DÖNÜŞ'] })], b)[0]).toMatchObject({ tur: 'DILIM_EKLE', eklenecekDilimIdleri: ['d2'] })
    expect(planla([tam({ dilimKodlari: ['SABAH_GIDIŞ'] })], b)[0].tur).toBe('DEGISIKLIK_YOK')
    expect(planla([tam({ durakKod: '', dilimKodlari: ['AKŞAM_DÖNÜŞ'] })], b)[0]).toMatchObject({ tur: 'DILIM_EKLE', durakId: 'dk1' })
  })

  it('🔴 YALNIZ DİLİM: güzergâh+durak boş → mevcut aktif atamaya dilim ekler (dilimsiz göç atamasını düzeltme yolu)', () => {
    const b = baglam({ aktifAtama: new Map([['p1', { ...MEVCUT, dilimIdleri: [] }]]) })
    const [s] = planla([ham({ satirNo: 2, sicil: '101', dilimKodlari: ['SABAH_GIDIŞ', 'AKŞAM_DÖNÜŞ'] })], b)
    expect(s).toMatchObject({ tur: 'YALNIZ_DILIM', eskiAtamaId: 'a1', eklenecekDilimIdleri: ['d1', 'd2'], guzergahKod: 'DARICA', mevcutKapsar: true })
    // başlangıç tarihi bu satır türünde gerekmez
    expect(s.hata).toBeNull()
  })

  it('YALNIZ DİLİM: aktif atama yoksa HATA; dilimler zaten bağlıysa DEGISIKLIK_YOK', () => {
    expect(planla([ham({ satirNo: 2, sicil: '101', dilimKodlari: ['SABAH_GIDIŞ'] })])[0].hata).toContain('Aktif atama yok')
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]) })
    expect(planla([ham({ satirNo: 2, sicil: '101', dilimKodlari: ['SABAH_GIDIŞ'] })], b)[0].tur).toBe('DEGISIKLIK_YOK')
  })
})

describe('planlama — hata türleri (satır numarasıyla)', () => {
  const planla = (satirlar: HamSatir[], b = baglam()) => satirlariPlanla(satirlar, b)
  const tam = (o: Partial<HamSatir> = {}) => ham({ satirNo: 7, sicil: '101', guzergahKod: 'DARICA', durakKod: 'DK-01', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: '2026-10-01', ...o })
  const hata = (o: Partial<HamSatir>, b?: PlanBaglami) => planla([tam(o)], b)[0]

  it.each([
    ['sicil boş', { sicil: '' }, 'Sicil No boş'],
    ['sicil bulunamadı', { sicil: '999' }, 'Sicil bulunamadı: 999'],
    ['pasif personel', { sicil: '103' }, 'Pasif personel servise atanamaz'],
    ['dilim boş (dilimsiz atama üretilmez)', { dilimKodlari: [] }, 'dilim zorunludur; dilimsiz atama üretilmez'],
    ['dilim kodu yok', { dilimKodlari: ['YOK_DILIM'] }, 'Sefer dilimi kodu bulunamadı: YOK_DILIM'],
    ['dilim pasif', { dilimKodlari: ['ESKİ_DİLİM'] }, 'Sefer dilimi pasif: ESKİ_DİLİM'],
    ['güzergâh kodu yok', { guzergahKod: 'YOK' }, 'Güzergâh kodu bulunamadı: YOK'],
    ['güzergâh pasif', { guzergahKod: 'ESKİ_GÜZERGÂH' }, 'Güzergâh pasif'],
    ['durak bu güzergâhta yok', { durakKod: 'USK-01' }, 'Durak bu güzergâhta yok: USK-01 (DARICA)'],
    ['durak pasif', { durakKod: 'DK-02' }, 'Durak pasif: DK-02'],
    ['durak var güzergâh yok', { guzergahKod: '', durakKod: 'DK-01' }, 'Durak kodu girildi ama Güzergâh Kodu boş'],
    ['tarih boş', { baslangic: '' }, 'Başlangıç tarihi zorunludur'],
    ['tarih biçimi geçersiz', { baslangic: 'yarın' }, 'Başlangıç tarihi geçersiz'],
    ['olmayan takvim günü', { baslangic: '2026-02-30' }, 'Başlangıç tarihi geçersiz'],
    ['2020 öncesi (A3)', { baslangic: '2019-12-31' }, '2020-01-01 tarihinden önce olamaz'],
    ['bir yıldan ileri (A3)', { baslangic: '2028-01-01' }, 'en fazla 1 yıl sonrası'],
  ])('%s → HATA', (_ad, o, parca) => {
    const s = hata(o as Partial<HamSatir>)
    expect(s.tur).toBe('HATA')
    expect(s.hata).toContain(parca)
    expect(s.satirNo).toBe(7)
  })

  it('🔴 aynı sicil dosyada iki kez → İKİ satır da hata; mesaj satır numaralarını söyler', () => {
    const [a, b, c] = planla([tam({ satirNo: 2 }), tam({ satirNo: 5 }), tam({ satirNo: 6, sicil: '102' })])
    expect(a.hata).toContain('2 satırda geçiyor (satır 2, 5)')
    expect(b.tur).toBe('HATA')
    expect(c.tur).toBe('YENI') // diğer sicil etkilenmez
  })

  it('🔴 C5: güzergâh/durak değişikliği transferle AYNI geçiş kuralı — bugün: eski anında pasif; İLERİ tarihli: eski o güne kadar aktif (bitiş = önceki gün), yeni o günde başlar', () => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]) })
    const degis = (baslangic: string) => hata({ guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01', baslangic }, b)
    expect(degis(BUGUN)).toMatchObject({ tur: 'DEGISIKLIK', eskiAktif: false, eskiBitis: '2026-10-03' })
    expect(degis('2026-10-20')).toMatchObject({ tur: 'DEGISIKLIK', eskiAktif: true, eskiBitis: '2026-10-19', baslangic: '2026-10-20' })
    expect(degis('2026-10-02')).toMatchObject({ eskiAktif: false, eskiBitis: '2026-10-02' })
  })

  it('🔴 değişiklik: mevcut atamanın başlangıcından önce / A3 aralığı dışı ise hata (transferle aynı mesajlar)', () => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]) })
    expect(hata({ guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01', baslangic: '2026-09-01' }, b).hata).toContain('eski atamanın başlangıç tarihinden önce olamaz')
    expect(hata({ guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01', baslangic: '2028-01-01' }, b).hata).toContain('en fazla 1 yıl sonrası')
    // yeni atama ileri tarihli olabilir (A3 aralığında)
    expect(hata({ sicil: '102', baslangic: '2026-12-01' }).tur).toBe('YENI')
  })

  it('🔴 personelin başlangıcı ileride aktif ataması varsa (ileri tarihli transfer bekliyor) satır HATA', () => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]), gelecekAtama: new Set(['p1']) })
    expect(hata({ guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01' }, b).hata).toContain('ileri tarihli (henüz başlamamış) aktif ataması var')
    expect(hata({ sicil: '102' }, b).tur).toBe('YENI') // başka personel etkilenmez
  })

  it('🔴 yetki: servis.create yoksa yeni atama, create+passive yoksa değişiklik satırı HATA (yetki aşılmaz); dilim ekleme edit ile yeter', () => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]), izinler: { create: false, passive: false } })
    expect(hata({ sicil: '102' }, b).hata).toContain('servis.create')
    expect(hata({ guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01' }, b).hata).toContain('servis.passive')
    expect(hata({ dilimKodlari: ['SABAH_GIDIŞ', 'AKŞAM_DÖNÜŞ'] }, b).tur).toBe('DILIM_EKLE')
  })

  it('ozetle: tür sayıları', () => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]) })
    const r = planla([
      tam({ satirNo: 2, sicil: '102' }), // yeni
      tam({ satirNo: 3, sicil: '101', dilimKodlari: ['AKŞAM_DÖNÜŞ', 'SABAH_GIDIŞ'] }), // dilim ekle
      tam({ satirNo: 4, sicil: '999' }), // hata
    ], b)
    expect(ozetle(r)).toEqual({ toplamSatir: 3, yeni: 1, degisiklik: 0, dilimEkle: 1, degismeyen: 0, hatali: 1 })
  })
})

describe('kapasite etkisi haritası (yalnız bugünün kapasitesine girenler)', () => {
  it('yeni/değişiklik: başlangıcı bugün/geçmişse sayılır, ileri tarihliyse sayılmaz; dilim ekleme: mevcut atama bugün kapsıyorsa', () => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]) })
    const s = satirlariPlanla([
      ham({ satirNo: 2, sicil: '102', guzergahKod: 'DARICA', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: '2026-10-01' }),
    ], b)
    const gelecek = satirlariPlanla([ham({ satirNo: 2, sicil: '102', guzergahKod: 'DARICA', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: '2026-12-01' })], b)
    expect(eklenenKisiHaritasi(s, BUGUN).get('g1')?.get('d1')).toBe(1)
    expect(eklenenKisiHaritasi(gelecek, BUGUN).size).toBe(0)
    const ekle = satirlariPlanla([ham({ satirNo: 2, sicil: '101', dilimKodlari: ['AKŞAM_DÖNÜŞ'] })], b)
    expect(eklenenKisiHaritasi(ekle, BUGUN).get('g1')?.get('d2')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// DB'li akış (sahte DB)
// ---------------------------------------------------------------------------
const atama = (id: string, personnelId: string, o: Partial<Atama> = {}): Atama => ({
  id, personnelId, guzergahId: 'g1', durakId: 'dk1', baslangicTarihi: new Date('2026-09-27'), bitisTarihi: null, aktif: true, atamaKaynagi: 'IMPORT', dilimler: [], ...o,
})
const dilimlerOf = (id: string) => (db.atamalar.get(id) as Atama).dilimler.map((d) => d.dilimId).sort()
const gecmis = () => db.gecmis as { hedefTipi: string; hedefId: string; islem: string; userId: string | null; oncekiDeger: unknown; yeniDeger: Record<string, unknown>; aciklama: string }[]

function dosya(satirlar: unknown[][]): HamSatir[] { return excelOku(xlsxOlustur(satirlar)) }

beforeEach(() => {
  db.personeller = [
    { id: 'p1', sicilNo: '101', adSoyad: 'Çağlar Şahin', aktif: true },
    { id: 'p2', sicilNo: '102', adSoyad: 'İlker Öztürk', aktif: true },
    { id: 'p3', sicilNo: '103', adSoyad: 'Şule Ğündoğdu', aktif: true },
  ]
  db.guzergahlar = [G1, G2, G3]
  db.dilimler = [D1, D2, D3]
  db.guzergahDuraklari = [
    { guzergahId: 'g1', aktif: true, durakId: 'dk1', durak: { kod: 'DK-01', aktif: true } },
    { guzergahId: 'g2', aktif: true, durakId: 'dk9', durak: { kod: 'USK-01', aktif: true } },
  ]
  db.atamalar.clear()
  db.gecmis.length = 0
  db.audit.length = 0
  db.seq = 0
  db.auditYazilamaz = false
  db.txteKapat = null
  db.yazmaSayaci = 0
  db.kapasite = {
    d1: { atananPersonelSayisi: 8, kapasite: 10, durum: 'UYGUN' },
    d2: { atananPersonelSayisi: 2, kapasite: 10, durum: 'UYGUN' },
  }
})

describe('önizleme — HİÇBİR KAYIT YAZMAZ', () => {
  it('özet + satırlar + kapasite etkisi; hiçbir yazma çağrısı yok', async () => {
    db.atamalar.set('a1', atama('a1', 'p1', { dilimler: [{ dilimId: 'd1' }] }))
    const satirlar = dosya([
      ['102', 'DARICA', 'DK-01', 'SABAH_GIDIŞ', '2026-10-01'], // yeni
      ['101', 'ÜSKÜDAR', 'USK-01', 'AKŞAM_DÖNÜŞ', '2026-10-02'], // değişiklik
      ['999', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01'], // hata
    ])
    const o = await excelOnizle(satirlar, IZIN, BUGUN)
    expect(o.ozet).toMatchObject({ toplamSatir: 3, yeni: 1, degisiklik: 1, dilimEkle: 0, hatali: 1, kapasiteUyarisi: 0 })
    expect(o.satirlar.map((s) => s.tur)).toEqual(['YENI', 'DEGISIKLIK', 'HATA'])
    expect(o.satirlar[0].adSoyad).toBe('İlker Öztürk')
    expect(o.etki.map((e) => [e.guzergahKod, e.dilimKod, e.once, e.sonra])).toEqual([['DARICA', 'SABAH_GIDIŞ', 8, 9], ['ÜSKÜDAR', 'AKŞAM_DÖNÜŞ', 2, 3]])
    expect(db.yazmaSayaci).toBe(0)
    expect(gecmis()).toHaveLength(0)
    expect(db.atamalar.size).toBe(1)
  })

  it('🔴 kapasite aşımı: etki satırı asim + uyarı sayısı; araçsız dilimde aşım yok', async () => {
    db.kapasite.d1 = { atananPersonelSayisi: 10, kapasite: 10, durum: 'UYGUN' }
    db.kapasite.d2 = { atananPersonelSayisi: 4, kapasite: 0, durum: 'ARAC_YOK' }
    const o = await excelOnizle(dosya([['102', 'DARICA', '', 'SABAH_GIDIŞ, AKŞAM_DÖNÜŞ', '2026-10-01']]), IZIN, BUGUN)
    expect(o.asimVar).toBe(true)
    expect(o.ozet.kapasiteUyarisi).toBe(1)
    expect(o.etki.find((e) => e.dilimId === 'd1')).toMatchObject({ asim: true, fazla: 1 })
    expect(o.etki.find((e) => e.dilimId === 'd2')).toMatchObject({ asim: false, aracYok: true, koltuk: null })
  })

  it('aynı satırlar iki kez önizlenirse sonuç aynı (yan etki yok)', async () => {
    const s = dosya([['102', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01']])
    const a = await excelOnizle(s, IZIN, BUGUN)
    const b = await excelOnizle(s, IZIN, BUGUN)
    expect(a.ozet).toEqual(b.ozet)
    expect(db.yazmaSayaci).toBe(0)
  })
})

describe('uygulama — tek transaction, ayrı tarihçe, ortak topluIslemId', () => {
  it('normal: YENİ + DEĞİŞİKLİK + DİLİM EKLE + YALNIZ DİLİM + hatalı (atlanır) birlikte; her kayıt için ayrı tarihçe, ortak topluIslemId', async () => {
    db.atamalar.set('a1', atama('a1', 'p1', { dilimler: [{ dilimId: 'd1' }] })) // 101: değişiklik
    db.atamalar.set('a3', atama('a3', 'p3', { dilimler: [] })) // 103: yalnız dilim (dilimsiz göç atamasi)
    const s = dosya([
      ['102', 'DARICA', 'DK-01', 'SABAH_GIDIŞ, AKŞAM_DÖNÜŞ', '2026-10-01'], // yeni
      ['101', 'ÜSKÜDAR', 'USK-01', 'AKŞAM_DÖNÜŞ', '2026-10-02'], // değişiklik
      ['103', '', '', 'SABAH_GIDIŞ', ''], // yalnız dilim
      ['999', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01'], // hatalı
    ])
    const r = await excelUygula(s, {}, 'u1', IZIN, BUGUN)
    expect(r).toMatchObject({ yeni: 1, degisiklik: 1, dilimEkle: 1, degismeyen: 0, atlanan: 1 })

    // yeni atama + dilimleri
    const yeniler = [...db.atamalar.values() as Iterable<Atama>].filter((a) => a.id.startsWith('yeni-'))
    expect(yeniler).toHaveLength(2) // 102 (yeni) + 101 (değişiklik yeni atama)
    const yeni102 = yeniler.find((a) => a.personnelId === 'p2')!
    expect(yeni102).toMatchObject({ guzergahId: 'g1', durakId: 'dk1', atamaKaynagi: 'IMPORT', aktif: true })
    expect(yeni102.dilimler.map((d) => d.dilimId).sort()).toEqual(['d1', 'd2'])
    // değişiklik: eski kapandı (bitiş = başlangıç tarihi), yenisi açık
    expect(db.atamalar.get('a1')).toMatchObject({ aktif: false, bitisTarihi: new Date('2026-10-02T00:00:00.000Z') })
    const yeni101 = yeniler.find((a) => a.personnelId === 'p1')!
    expect(yeni101).toMatchObject({ guzergahId: 'g2', durakId: 'dk9' })
    // yalnız dilim
    expect(dilimlerOf('a3')).toEqual(['d1'])

    // tarihçe: HER kayıt için ayrı satır, hepsinde ortak topluIslemId
    const g = gecmis()
    const idler = new Set(g.map((x) => x.yeniDeger.topluIslemId))
    expect(idler.size).toBe(1)
    expect([...idler][0]).toBe(r.topluIslemId)
    expect(g.filter((x) => x.hedefTipi === 'PERSONEL_ATAMA' && x.islem === 'OLUSTURMA')).toHaveLength(2)
    expect(g.filter((x) => x.hedefTipi === 'PERSONEL_ATAMA_DILIM' && x.islem === 'OLUSTURMA')).toHaveLength(2)
    expect(g.filter((x) => x.hedefTipi === 'PERSONEL_ATAMA' && x.islem === 'PASIFLESTIRME')).toHaveLength(1)
    const dilimGuncelle = g.find((x) => x.hedefId === 'a3')!
    expect(dilimGuncelle).toMatchObject({ hedefTipi: 'PERSONEL_ATAMA_DILIM', islem: 'GUNCELLEME', userId: 'u1' })
    expect(dilimGuncelle.oncekiDeger).toEqual({ dilimIdleri: [], dilimKodlari: [] })
    expect(dilimGuncelle.yeniDeger).toMatchObject({ dilimIdleri: ['d1'], dilimKodlari: ['SABAH_GIDIŞ'] })
    expect(g.every((x) => x.aciklama.startsWith('Excel toplu atama'))).toBe(true)
  })

  it('🔴 KVKK: denetim kaydına YALNIZ sayılar + topluIslemId yazılır (sicil/ad soyad/dosya içeriği YOK)', async () => {
    const s = dosya([['102', 'DARICA', 'DK-01', 'SABAH_GIDIŞ', '2026-10-01']])
    const r = await excelUygula(s, {}, 'u1', IZIN, BUGUN)
    expect(db.audit).toHaveLength(1)
    const a = db.audit[0] as { action: string; actorId: string; targetType: string; targetId: string; details: Record<string, unknown> }
    expect(a).toMatchObject({ action: 'SERVIS_EXCEL_TOPLU_ATAMA', actorId: 'u1', targetType: 'SERVIS', targetId: r.topluIslemId })
    expect(a.details).toEqual({ topluIslemId: r.topluIslemId, dosyaSatiri: 1, yeni: 1, degisiklik: 0, dilimEkle: 0, degismeyen: 0, atlanan: 0 })
    expect(JSON.stringify(a)).not.toMatch(/102|Öztürk|İlker|DK-01/)
    // tarihçede de kişi adı/sicil yok (yalnız teknik kimlik)
    expect(JSON.stringify(gecmis())).not.toMatch(/Öztürk|İlker|"102"/)
  })

  it('🔴 aşım: onay YOK → ASIM_ONAYI_GEREKLI, hiçbir şey yazılmaz; onay VAR → uygulanır', async () => {
    db.kapasite.d1 = { atananPersonelSayisi: 10, kapasite: 10, durum: 'UYGUN' }
    const s = dosya([['102', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01']])
    const e = await excelUygula(s, {}, 'u1', IZIN, BUGUN).catch((x: { kod?: string }) => x)
    expect((e as { kod?: string }).kod).toBe('ASIM_ONAYI_GEREKLI')
    expect(db.yazmaSayaci).toBe(0)
    expect(gecmis()).toHaveLength(0)
    await excelUygula(s, { asimOnayi: true }, 'u1', IZIN, BUGUN)
    expect(db.atamalar.size).toBe(1)
  })

  it('🔴 hepsi ya da hiçbiri: sonraki satırda atama işlem sırasında kapanırsa İLK satırın yazdığı da geri alınır, tarihçe/denetim yok', async () => {
    db.atamalar.set('a1', atama('a1', 'p1', { dilimler: [{ dilimId: 'd1' }] }))
    db.txteKapat = 'a1'
    const s = dosya([
      ['102', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01'], // yeni (önce yazılır)
      ['101', 'DARICA', 'DK-01', 'SABAH_GIDIŞ, AKŞAM_DÖNÜŞ', '2026-10-01'], // dilim ekle → a1 tx içinde kapanır
    ])
    await expect(excelUygula(s, {}, 'u1', IZIN, BUGUN)).rejects.toThrow('Satır 3')
    expect([...db.atamalar.keys()]).toEqual(['a1']) // yeni atama GERİ ALINDI
    expect(gecmis()).toHaveLength(0)
    expect(db.audit).toHaveLength(0)
  })

  it('🔴 audit fail-closed: denetim yazılamazsa tüm işlem geri alınır', async () => {
    db.auditYazilamaz = true
    await expect(excelUygula(dosya([['102', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01']]), {}, 'u1', IZIN, BUGUN)).rejects.toThrow('audit')
    expect(db.atamalar.size).toBe(0)
    expect(gecmis()).toHaveLength(0)
  })

  it('geçerli satır yoksa hata; önizleme sonrası veri değiştiyse (beklenen sayılar uyuşmaz) uygulanmaz', async () => {
    await expect(excelUygula(dosya([['999', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01']]), {}, 'u1', IZIN, BUGUN)).rejects.toThrow('Uygulanacak geçerli satır yok')
    const s = dosya([['102', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01'], ['999', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01']])
    await expect(excelUygula(s, { beklenen: { gecerli: 2, hatali: 0 } }, 'u1', IZIN, BUGUN)).rejects.toThrow('Önizlemeden sonra veriler değişti')
    expect(db.atamalar.size).toBe(0)
    await excelUygula(s, { beklenen: { gecerli: 1, hatali: 1 } }, 'u1', IZIN, BUGUN)
    expect(db.atamalar.size).toBe(1)
  })

  it('sonradan değişiklik / idempotent: aynı dosya ikinci kez uygulanınca satırlar "değişiklik yok" olur → uygulanacak satır yok', async () => {
    const s = dosya([['102', 'DARICA', 'DK-01', 'SABAH_GIDIŞ', '2026-10-01']])
    await excelUygula(s, {}, 'u1', IZIN, BUGUN)
    await expect(excelUygula(s, {}, 'u1', IZIN, BUGUN)).rejects.toThrow('Uygulanacak geçerli satır yok')
    expect(gecmis().filter((g) => g.hedefTipi === 'PERSONEL_ATAMA' && g.islem === 'OLUSTURMA')).toHaveLength(1)
  })

  it('güvenli geri dönüş: toplu işlem tarihçeden izlenebilir (topluIslemId ile bulunur) ve yeni atama tek tek kapatılabilir (aktif atama)', async () => {
    const r = await excelUygula(dosya([['102', 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01'], ['103', 'ÜSKÜDAR', '', 'AKŞAM_DÖNÜŞ', '2026-10-01']]), {}, 'u1', IZIN, BUGUN)
    const buTopluIslem = gecmis().filter((g) => g.yeniDeger.topluIslemId === r.topluIslemId)
    expect(buTopluIslem.length).toBe(4) // 2 atama + 2 dilim kaydı
    // her atama normal aktif atama: mevcut "Kapat" akışıyla tek tek kapatılabilir
    const yeniler = [...db.atamalar.values() as Iterable<Atama>]
    expect(yeniler.every((a) => a.aktif && a.bitisTarihi === null)).toBe(true)
  })

  it('sınır: 500 satırlık dosya okunur ve planlanır', async () => {
    db.personeller = Array.from({ length: 500 }, (_, i) => ({ id: `p${i}`, sicilNo: String(1000 + i), adSoyad: `Kişi ${i}`, aktif: true }))
    const s = dosya(Array.from({ length: 500 }, (_, i) => [String(1000 + i), 'DARICA', '', 'AKŞAM_DÖNÜŞ', '2026-10-01']))
    const o = await excelOnizle(s, IZIN, BUGUN)
    expect(o.ozet).toMatchObject({ toplamSatir: 500, yeni: 500, hatali: 0 })
  })
})

describe('C5 — Excel değişikliği, transferle AYNI geçiş sonucunu verir (ortak örnek tablosu)', () => {
  it.each(GECIS_ORNEKLERI)('$ad ($gun): eskiAktif / eskiBitis', (o) => {
    const b = baglam({ aktifAtama: new Map([['p1', MEVCUT]]) })
    const [s] = satirlariPlanla([ham({ satirNo: 2, sicil: '101', guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: o.gun })], b)
    expect(s).toMatchObject({ tur: 'DEGISIKLIK', eskiAktif: o.eskiAktif, eskiBitis: o.eskiBitis, baslangic: o.gun })
  })
})

describe('C5 — ileri tarihli güzergâh/durak değişikliği (uygulama)', () => {
  it('🔴 eski atama o güne kadar AKTİF kalır (bitiş = önceki gün), yeni atama geçiş gününde başlar; bugünün kapasitesine yalnız başlamış olanlar girer', async () => {
    db.atamalar.set('a1', atama('a1', 'p1', { dilimler: [{ dilimId: 'd1' }] }))
    const s = dosya([['101', 'ÜSKÜDAR', 'USK-01', 'AKŞAM_DÖNÜŞ', '2026-10-20']])
    const o = await excelOnizle(s, IZIN, BUGUN)
    expect(o.etki).toHaveLength(0) // yeni atama bugün başlamadı → kapasiteye girmez
    await excelUygula(s, {}, 'u1', IZIN, BUGUN)
    expect(db.atamalar.get('a1')).toMatchObject({ aktif: true, bitisTarihi: new Date('2026-10-19T00:00:00.000Z') })
    const yeni = [...db.atamalar.values() as Iterable<Atama>].find((a) => a.id.startsWith('yeni-'))!
    expect(yeni).toMatchObject({ guzergahId: 'g2', aktif: true, baslangicTarihi: new Date('2026-10-20T00:00:00.000Z'), bitisTarihi: null })
    // tarihçe: eski atama için GUNCELLEME (PASIFLESTIRME DEĞİL), planlı açıklama
    const eskiKayit = gecmis().find((g) => g.hedefId === 'a1')!
    expect(eskiKayit.islem).toBe('GUNCELLEME')
    expect(eskiKayit.aciklama).toContain('planlı: 2026-10-20')
    expect(eskiKayit.yeniDeger).toMatchObject({ bitisTarihi: '2026-10-19', aktif: true })
  })

  it('bugün tarihli değişiklikte eski anında pasif (PASIFLESTIRME), bitiş = geçiş günü', async () => {
    db.atamalar.set('a1', atama('a1', 'p1', { dilimler: [{ dilimId: 'd1' }] }))
    await excelUygula(dosya([['101', 'ÜSKÜDAR', 'USK-01', 'AKŞAM_DÖNÜŞ', BUGUN]]), {}, 'u1', IZIN, BUGUN)
    expect(db.atamalar.get('a1')).toMatchObject({ aktif: false, bitisTarihi: new Date('2026-10-03T00:00:00.000Z') })
    expect(gecmis().find((g) => g.hedefId === 'a1')!.islem).toBe('PASIFLESTIRME')
  })

  it('🔴 bekleyen ileri tarihli atamayla aynı dosya tekrar yüklenirse satır HATA (ikinci aktif atama açılmaz)', async () => {
    db.atamalar.set('a1', atama('a1', 'p1', { dilimler: [{ dilimId: 'd1' }] }))
    const s = dosya([['101', 'ÜSKÜDAR', 'USK-01', 'AKŞAM_DÖNÜŞ', '2026-10-20']])
    await excelUygula(s, {}, 'u1', IZIN, BUGUN)
    const o = await excelOnizle(s, IZIN, BUGUN)
    expect(o.satirlar[0].tur).toBe('HATA')
    expect(o.satirlar[0].hata).toContain('ileri tarihli')
  })
})

describe('dosyalar', () => {
  it('şablon: Atama (yalnız başlık), Açıklama, Kodlar sayfaları; Türkçe kodlar; örnek veri yok', () => {
    const buf = sablonOlustur({
      guzergahlar: [{ kod: 'ÜSKÜDAR', ad: 'Üsküdar-Zeynepkamil' }],
      duraklar: [{ guzergahKod: 'ÜSKÜDAR', kod: 'USK-01', ad: 'Şemsipaşa' }],
      dilimler: [{ kod: 'SABAH_GIDIŞ', ad: 'Sabah' }],
    })
    const wb = XLSX.read(buf, { type: 'buffer' })
    expect(wb.SheetNames).toEqual(['Atama', 'Açıklama', 'Kodlar'])
    const atama = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Atama'], { header: 1 })
    expect(atama).toEqual([[...SABLON_BASLIKLARI]]) // yüklenmeye hazır, boş
    const kodlar = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets['Kodlar'], { header: 1 }))
    expect(kodlar).toContain('ÜSKÜDAR')
    expect(kodlar).toContain('Şemsipaşa')
    // şablon, okuyucuyla "veri yok" hatası verir (başlıklar tanınır)
    expect(() => excelOku(buf)).toThrow('veri satırı yok')
  })

  it('hata raporu: yalnız hatalı satırlar, satır numarası + sicil + kodlar + hata (Türkçe)', () => {
    const b = baglam()
    const r = satirlariPlanla([
      ham({ satirNo: 2, sicil: '101', guzergahKod: 'DARICA', dilimKodlari: ['SABAH_GIDIŞ'], baslangic: '2026-10-01' }),
      ham({ satirNo: 5, sicil: '999', guzergahKod: 'ÜSKÜDAR', durakKod: 'USK-01', dilimKodlari: ['AKŞAM_DÖNÜŞ'], baslangic: '2026-10-01' }),
      ham({ satirNo: 9, sicil: '102', guzergahKod: 'DARICA', dilimKodlari: [], baslangic: '2026-10-01' }),
    ], b)
    const wb = XLSX.read(hataRaporuOlustur(r), { type: 'buffer' })
    const t = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Hatalar'], { header: 1 })
    expect(t[0]).toEqual([...HATA_RAPORU_BASLIKLARI])
    expect(t).toHaveLength(3)
    expect(t[1]).toEqual([5, '999', 'ÜSKÜDAR', 'USK-01', 'AKŞAM_DÖNÜŞ', '2026-10-01', 'Sicil bulunamadı: 999.'])
    expect(t[2][0]).toBe(9)
    expect(String(t[2][6])).toContain('dilimsiz atama üretilmez')
  })

  it('hata yoksa rapor yalnız başlık satırı (boş durum)', () => {
    const wb = XLSX.read(hataRaporuOlustur([]), { type: 'buffer' })
    expect(XLSX.utils.sheet_to_json(wb.Sheets['Hatalar'], { header: 1 })).toHaveLength(1)
  })
})
