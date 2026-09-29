import { describe, expect, it, vi } from 'vitest'
import { ARACLAR, SEFER_DILIMLERI, TUM_GUZERGAHLAR } from './servis-tanim-verisi'
import { isleAraclar, isleGuzergahVeDuraklar, isleSeferDilimleri } from './servis-tanim-seed-mantigi'

function toplamDurakSayisi() {
  return TUM_GUZERGAHLAR.reduce((s, g) => s + g.duraklar.length, 0)
}

function mockPrisma(opts: {
  guzergahVar: boolean
  durakVar: boolean
  bagVar: boolean | ((guzergahId: string, durakId: string) => boolean)
}) {
  const create = vi.fn().mockResolvedValue({ id: 'yeni' })
  const bagVarFn =
    typeof opts.bagVar === 'function' ? opts.bagVar : () => opts.bagVar as boolean

  return {
    prisma: {
      servisGuzergah: {
        findFirst: vi.fn(async ({ where }: { where: { kod: string } }) =>
          opts.guzergahVar ? { id: `g-${where.kod}` } : null,
        ),
        create,
      },
      servisDurak: {
        findFirst: vi.fn(async ({ where }: { where: { kod: string } }) =>
          opts.durakVar ? { id: `d-${where.kod}` } : null,
        ),
        create,
      },
      servisGuzergahDurak: {
        findFirst: vi.fn(async ({ where }: { where: { guzergahId: string; durakId: string } }) =>
          bagVarFn(where.guzergahId, where.durakId) ? { id: 'bag' } : null,
        ),
        create,
      },
    },
    create,
  }
}

describe('isleGuzergahVeDuraklar — bag +138 regresyon testi', () => {
  it('ilk --apply sonrasını simüle eder: tüm kayıtlar zaten var → dry-run "eklenecek 0" verir', async () => {
    const { prisma, create } = mockPrisma({ guzergahVar: true, durakVar: true, bagVar: true })

    const sonuc = await isleGuzergahVeDuraklar(prisma, false, 'yerleske-1', TUM_GUZERGAHLAR)

    expect(sonuc.olusturulacak).toEqual({ guzergah: 0, durak: 0, bag: 0 })
    expect(sonuc.mevcut.bag).toBe(toplamDurakSayisi())
    expect(sonuc.mevcut.durak).toBe(toplamDurakSayisi())
    expect(sonuc.mevcut.guzergah).toBe(TUM_GUZERGAHLAR.length)
    // dry-run: apply sonrası durum simüle edilse bile hiçbir create çağrılmaz
    expect(create).not.toHaveBeenCalled()
  })

  it('hiçbir kayıt yokken dry-run: tüm durak/bağ "oluşturulacak" sayılır, yine de yazılmaz', async () => {
    const { prisma, create } = mockPrisma({ guzergahVar: false, durakVar: false, bagVar: false })

    const sonuc = await isleGuzergahVeDuraklar(prisma, false, 'yerleske-1', TUM_GUZERGAHLAR)

    expect(sonuc.olusturulacak.durak).toBe(toplamDurakSayisi())
    expect(sonuc.olusturulacak.bag).toBe(toplamDurakSayisi())
    expect(sonuc.olusturulacak.guzergah).toBe(TUM_GUZERGAHLAR.length)
    expect(create).not.toHaveBeenCalled()
  })

  it('kısmi durum (bug\'ın asıl kanıtı): güzergâh/durak MEVCUT ama tek bir bağ eksik → bag "oluşturulacak" tam 1 olmalı, tümü değil', async () => {
    let ilkCagrininAnahtari: string | null = null
    const { prisma } = mockPrisma({
      guzergahVar: true,
      durakVar: true,
      bagVar: (guzergahId, durakId) => {
        const anahtar = `${guzergahId}|${durakId}`
        if (ilkCagrininAnahtari === null) {
          ilkCagrininAnahtari = anahtar
          return false // yalnız ilk çağrılan bağ eksik
        }
        return true
      },
    })

    const sonuc = await isleGuzergahVeDuraklar(prisma, false, 'yerleske-1', TUM_GUZERGAHLAR)

    // 🔴 Bu satır, düzeltilmeden önceki bug'ı (bagVar sorgusunun dry-run'da
    // hiç çalışmaması, her durağın bağını unconditional "yeni" sayması)
    // yakalardı: eski kodda bu değer toplamDurakSayisi() (138) olurdu.
    expect(sonuc.olusturulacak.bag).toBe(1)
    expect(sonuc.mevcut.bag).toBe(toplamDurakSayisi() - 1)
    expect(sonuc.olusturulacak.durak).toBe(0)
    expect(sonuc.olusturulacak.guzergah).toBe(0)
  })
})

function mockAracPrisma(opts: { aracVar: boolean; firmaVar: boolean }) {
  const aracCreate = vi.fn().mockResolvedValue({ id: 'yeni-arac' })
  // 🔴 Gerçek DB find-or-create'i simüle eder: firmaVar başlangıç durumunu
  // verir, ama create() çağrıldıktan SONRA aynı ad için findFirst artık
  // "var" döner (gerçek DB'de olduğu gibi) — aksi halde aynı firma her
  // araç için tekrar tekrar "yaratılacak" sanılır (yanlış-pozitif dedup testi).
  const bilinenFirmalar = new Set<string>()
  const firmaCreate = vi.fn(async ({ data }: { data: { ad: string } }) => {
    bilinenFirmalar.add(data.ad)
    return { id: `firma-${data.ad}` }
  })
  return {
    prisma: {
      servisArac: {
        findFirst: vi.fn(async () => (opts.aracVar ? { id: 'arac-1' } : null)),
        create: aracCreate,
      },
      servisFirma: {
        findFirst: vi.fn(async ({ where }: { where: { ad: string } }) =>
          opts.firmaVar || bilinenFirmalar.has(where.ad) ? { id: `firma-${where.ad}` } : null,
        ),
        create: firmaCreate,
      },
    },
    aracCreate,
    firmaCreate,
  }
}

describe('isleAraclar', () => {
  it('ilk --apply sonrasını simüle eder: tüm araçlar zaten var → dry-run "eklenecek 0" verir', async () => {
    const { prisma, aracCreate } = mockAracPrisma({ aracVar: true, firmaVar: true })
    const sonuc = await isleAraclar(prisma, false, ARACLAR)
    expect(sonuc.olusturulacak.arac).toBe(0)
    expect(sonuc.mevcut.arac).toBe(ARACLAR.length)
    expect(aracCreate).not.toHaveBeenCalled()
  })

  it('hiçbir araç yokken dry-run: tümü "oluşturulacak" sayılır, yazılmaz', async () => {
    const { prisma, aracCreate } = mockAracPrisma({ aracVar: false, firmaVar: false })
    const sonuc = await isleAraclar(prisma, false, ARACLAR)
    expect(sonuc.olusturulacak.arac).toBe(ARACLAR.length)
    expect(aracCreate).not.toHaveBeenCalled()
  })

  it('--apply + firma mevcut değilse: firma da find-or-create ile oluşturulur', async () => {
    const { prisma, aracCreate, firmaCreate } = mockAracPrisma({ aracVar: false, firmaVar: false })
    await isleAraclar(prisma, true, ARACLAR)
    expect(aracCreate).toHaveBeenCalledTimes(ARACLAR.length)
    // dev'de araçlar 2 farklı firmaya bağlı (bkz. servis-tanim-verisi.ts) —
    // firma create çağrı sayısı ARAÇ sayısından AZ olmalı (aynı firma tekrar yaratılmaz)
    expect(firmaCreate.mock.calls.length).toBeGreaterThan(0)
    expect(firmaCreate.mock.calls.length).toBeLessThan(ARACLAR.length)
  })
})

function mockDilimPrisma(opts: { dilimVar: boolean }) {
  const create = vi.fn().mockResolvedValue({ id: 'yeni-dilim' })
  return {
    prisma: {
      servisSeferDilimi: {
        findFirst: vi.fn(async () => (opts.dilimVar ? { id: 'dilim-1' } : null)),
        create,
      },
    },
    create,
  }
}

describe('isleSeferDilimleri', () => {
  it('ilk --apply sonrasını simüle eder: tüm dilimler zaten var → dry-run "eklenecek 0" verir', async () => {
    const { prisma, create } = mockDilimPrisma({ dilimVar: true })
    const sonuc = await isleSeferDilimleri(prisma, false, SEFER_DILIMLERI)
    expect(sonuc.olusturulacak.dilim).toBe(0)
    expect(sonuc.mevcut.dilim).toBe(SEFER_DILIMLERI.length)
    expect(create).not.toHaveBeenCalled()
  })

  it('hiçbir dilim yokken dry-run: tümü "oluşturulacak" sayılır, yazılmaz', async () => {
    const { prisma, create } = mockDilimPrisma({ dilimVar: false })
    const sonuc = await isleSeferDilimleri(prisma, false, SEFER_DILIMLERI)
    expect(sonuc.olusturulacak.dilim).toBe(SEFER_DILIMLERI.length)
    expect(create).not.toHaveBeenCalled()
  })
})
