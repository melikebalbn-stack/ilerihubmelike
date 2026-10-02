import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ARACLAR, GUZERGAH_ARAC_ANA_ATAMA, SEFER_DILIMLERI, TUM_GUZERGAHLAR } from './servis-tanim-verisi'
import {
  SAYIM_ANAHTARLARI,
  TanimHatasi,
  cliCoz,
  placeholderKontrol,
  planSayimi,
  planla,
  uygula,
  type PlanGirdisi,
  type Sayim,
  type TanimPrisma,
} from './servis-tanim-seed-mantigi'

const MODELLER = [
  'servisYerleske',
  'servisFirma',
  'servisGuzergah',
  'servisDurak',
  'servisGuzergahDurak',
  'servisArac',
  'servisSeferDilimi',
] as const
type ModelAdi = (typeof MODELLER)[number]
type Satir = Record<string, unknown> & { id: string }

/** Bellek içi sahte DB: findFirst where-eşitliğiyle arar, create satır ekler. Her çağrı sayılır. */
function sahteDb() {
  const tablolar = Object.fromEntries(MODELLER.map((m) => [m, [] as Satir[]])) as Record<ModelAdi, Satir[]>
  const findFirst = Object.fromEntries(MODELLER.map((m) => [m, vi.fn()])) as Record<ModelAdi, ReturnType<typeof vi.fn>>
  const create = Object.fromEntries(MODELLER.map((m) => [m, vi.fn()])) as Record<ModelAdi, ReturnType<typeof vi.fn>>
  let sayac = 0

  const prisma = Object.fromEntries(
    MODELLER.map((m) => {
      findFirst[m].mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
        return tablolar[m].find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null
      })
      create[m].mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const satir = { ...data, id: `${m}-${++sayac}` }
        tablolar[m].push(satir)
        return satir
      })
      return [m, { findFirst: findFirst[m], create: create[m] }]
    }),
  ) as unknown as TanimPrisma

  const createSayisi = () => Object.values(create).reduce((t, f) => t + f.mock.calls.length, 0)
  const findFirstSayisi = () => Object.values(findFirst).reduce((t, f) => t + f.mock.calls.length, 0)
  return { prisma, tablolar, findFirst, create, createSayisi, findFirstSayisi }
}

const GIRDI: PlanGirdisi = {
  yerleskeKod: 'YRL',
  yerleskeAd: 'Test Yerleşke',
  guzergahlar: TUM_GUZERGAHLAR,
  araclar: ARACLAR,
  dilimler: SEFER_DILIMLERI,
}

const TOPLAM_DURAK = TUM_GUZERGAHLAR.reduce((t, g) => t + g.duraklar.length, 0)

/** Sahte DB'deki create çağrılarını varlık türüne göre Sayim biçimine çevirir. */
function gercekCreateSayimi(db: ReturnType<typeof sahteDb>): Sayim {
  return {
    yerleske: db.create.servisYerleske.mock.calls.length,
    firma: db.create.servisFirma.mock.calls.length,
    guzergah: db.create.servisGuzergah.mock.calls.length,
    durak: db.create.servisDurak.mock.calls.length,
    bag: db.create.servisGuzergahDurak.mock.calls.length,
    arac: db.create.servisArac.mock.calls.length,
    dilim: db.create.servisSeferDilimi.mock.calls.length,
  }
}

describe('seed verisi — araç dışı, yer tutucu yok', () => {
  it('ARACLAR ve GUZERGAH_ARAC_ANA_ATAMA boş', () => {
    expect(ARACLAR).toHaveLength(0)
    expect(GUZERGAH_ARAC_ANA_ATAMA).toHaveLength(0)
  })

  it('veri dosyasında yer tutucu firma metni (kod ya da yorum olarak) geçmiyor', () => {
    const kaynak = readFileSync(resolve(process.cwd(), 'src/lib/servis-yonetimi/servis-tanim-verisi.ts'), 'utf8')
    const satirlar = kaynak.split('\n').filter((l) => /placeholder|taşeron firma/i.test(l))
    expect(satirlar).toEqual([])
  })
})

describe('planla + uygula — araçsız mod', () => {
  it('boş DB: firma ve araç için HİÇ sorgu/create yok; sayımlar beklenen', async () => {
    const db = sahteDb()
    const plan = await planla(db.prisma, GIRDI)
    const { olusturulacak } = planSayimi(plan)
    await uygula(db.prisma, plan)

    expect(olusturulacak).toEqual({
      yerleske: 1, firma: 0, guzergah: 10, durak: TOPLAM_DURAK, bag: TOPLAM_DURAK, arac: 0, dilim: 2,
    })
    expect(TOPLAM_DURAK).toBe(138)
    expect(db.create.servisFirma).not.toHaveBeenCalled()
    expect(db.create.servisArac).not.toHaveBeenCalled()
    expect(db.findFirst.servisFirma).not.toHaveBeenCalled()
    expect(db.findFirst.servisArac).not.toHaveBeenCalled()
    expect(db.tablolar.servisFirma).toHaveLength(0)
    expect(db.tablolar.servisArac).toHaveLength(0)
  })

  it('planla() yalnız okur: dry-run (yalnız planla) hiçbir create çağırmaz', async () => {
    const db = sahteDb()
    await planla(db.prisma, GIRDI)
    expect(db.createSayisi()).toBe(0)
  })
})

describe('plan sayıları = apply sayıları (her varlık türü)', () => {
  it('boş DB senaryosu', async () => {
    const db = sahteDb()
    const plan = await planla(db.prisma, GIRDI)
    const { olusturulacak } = planSayimi(plan)
    const yazilan = await uygula(db.prisma, plan)

    for (const k of SAYIM_ANAHTARLARI) {
      expect(yazilan[k], `uygula dönüşü: ${k}`).toBe(olusturulacak[k])
      expect(gercekCreateSayimi(db)[k], `gerçek create çağrısı: ${k}`).toBe(olusturulacak[k])
    }
  })

  it('tamamen dolu (idempotent) senaryo: plan 0, apply 0 create', async () => {
    const db = sahteDb()
    await uygula(db.prisma, await planla(db.prisma, GIRDI)) // ilk apply
    for (const f of Object.values(db.create)) f.mockClear()

    const plan = await planla(db.prisma, GIRDI)
    const { olusturulacak, mevcut } = planSayimi(plan)
    const yazilan = await uygula(db.prisma, plan)

    for (const k of SAYIM_ANAHTARLARI) {
      expect(olusturulacak[k], `plan: ${k}`).toBe(0)
      expect(yazilan[k], `apply: ${k}`).toBe(0)
    }
    expect(db.createSayisi()).toBe(0)
    expect(mevcut).toMatchObject({ yerleske: 1, guzergah: 10, durak: 138, bag: 138, dilim: 2, firma: 0, arac: 0 })
  })

  it('kısmi durum: güzergâh+durak VAR ama bazı bağlar ve bir dilim eksik → sayımlar yine eşit', async () => {
    const db = sahteDb()
    await uygula(db.prisma, await planla(db.prisma, GIRDI))
    db.tablolar.servisGuzergahDurak.splice(0, 5) // 5 bağ silindi
    db.tablolar.servisSeferDilimi.splice(0, 1) // 1 dilim silindi
    for (const f of Object.values(db.create)) f.mockClear()

    const plan = await planla(db.prisma, GIRDI)
    const { olusturulacak } = planSayimi(plan)
    expect(olusturulacak).toMatchObject({ bag: 5, dilim: 1, durak: 0, guzergah: 0, yerleske: 0 })
    const yazilan = await uygula(db.prisma, plan)
    for (const k of SAYIM_ANAHTARLARI) {
      expect(yazilan[k], k).toBe(olusturulacak[k])
      expect(gercekCreateSayimi(db)[k], `create: ${k}`).toBe(olusturulacak[k])
    }
  })

  it('araçlı veri (gelecekteki gerçek ad senaryosu): firma bir kez, araç sayıları eşit', async () => {
    const girdi: PlanGirdisi = {
      ...GIRDI,
      araclar: [
        { plaka: '34 TEST 01', kapasite: 15, firmaAd: 'Örnek Taşıma A.Ş.' },
        { plaka: '34 TEST 02', kapasite: 27, firmaAd: 'Örnek Taşıma A.Ş.' },
        { plaka: '34 TEST 03', kapasite: 27, firmaAd: 'Diğer Servis Ltd.' },
      ],
    }
    const db = sahteDb()
    const plan = await planla(db.prisma, girdi)
    const { olusturulacak } = planSayimi(plan)
    expect(olusturulacak).toMatchObject({ firma: 2, arac: 3 })
    const yazilan = await uygula(db.prisma, plan)
    for (const k of SAYIM_ANAHTARLARI) {
      expect(yazilan[k], k).toBe(olusturulacak[k])
      expect(gercekCreateSayimi(db)[k], `create: ${k}`).toBe(olusturulacak[k])
    }
    // araçlar kendi firmasına bağlandı
    const firmaId = (ad: string) => db.tablolar.servisFirma.find((f) => f.ad === ad)!.id
    expect(db.tablolar.servisArac.find((a) => a.plaka === '34 TEST 03')!.firmaId).toBe(firmaId('Diğer Servis Ltd.'))

    // ikinci koşu: idempotent
    for (const f of Object.values(db.create)) f.mockClear()
    const plan2 = await planla(db.prisma, girdi)
    expect(planSayimi(plan2).olusturulacak).toEqual({
      yerleske: 0, firma: 0, guzergah: 0, durak: 0, bag: 0, arac: 0, dilim: 0,
    })
    await uygula(db.prisma, plan2)
    expect(db.createSayisi()).toBe(0)
  })
})

describe('PLACEHOLDER savunma kontrolü', () => {
  it('placeholder içeren firma adı: planla DB\'ye HİÇ dokunmadan hata verir', async () => {
    const db = sahteDb()
    const girdi: PlanGirdisi = {
      ...GIRDI,
      araclar: [{ plaka: '34 TEST 01', kapasite: 15, firmaAd: 'Firma A (PLACEHOLDER - Genel)' }],
    }
    await expect(planla(db.prisma, girdi)).rejects.toThrow(TanimHatasi)
    expect(db.findFirstSayisi()).toBe(0)
    expect(db.createSayisi()).toBe(0)
  })

  it('büyük/küçük harfe duyarsız ve plaka alanını da kapsar', () => {
    expect(() => placeholderKontrol([{ plaka: '34 X', kapasite: 1, firmaAd: 'x placeholder y' }])).toThrow(TanimHatasi)
    expect(() => placeholderKontrol([{ plaka: 'PlaceHolder-1', kapasite: 1, firmaAd: 'Gerçek Firma' }])).toThrow(TanimHatasi)
  })

  it('temiz veri ve boş liste geçer', () => {
    expect(() => placeholderKontrol([])).not.toThrow()
    expect(() => placeholderKontrol([{ plaka: '34 X', kapasite: 1, firmaAd: 'Gerçek Firma' }])).not.toThrow()
  })
})

describe('CLI parametreleri', () => {
  const tam = ['--db=ilerihub_dev_elif', '--yerleske-kod=YRL', '--yerleske-ad=Test Yerleşke']

  it('tam parametre çözülür; --apply yoksa dry-run', () => {
    expect(cliCoz(tam)).toEqual({ db: 'ilerihub_dev_elif', yerleskeKod: 'YRL', yerleskeAd: 'Test Yerleşke', apply: false })
    expect(cliCoz([...tam, '--apply']).apply).toBe(true)
  })

  it('yerleşke kodu eksikse açık hata (dry-run dahil)', () => {
    expect(() => cliCoz(['--db=x', '--yerleske-ad=Y'])).toThrow(/--yerleske-kod=<deger> ZORUNLU/)
  })

  it('yerleşke adı eksikse açık hata (dry-run dahil)', () => {
    expect(() => cliCoz(['--db=x', '--yerleske-kod=K'])).toThrow(/--yerleske-ad=<deger> ZORUNLU/)
  })

  it('--db eksikse açık hata', () => {
    expect(() => cliCoz(['--yerleske-kod=K', '--yerleske-ad=Y'])).toThrow(/--db=<deger> ZORUNLU/)
  })

  it('kaldırılan --firma-ad verilirse sessizce yok sayılmaz, hata verir', () => {
    expect(() => cliCoz([...tam, '--firma-ad=Bir Firma'])).toThrow(/--firma-ad KALDIRILDI/)
  })
})
