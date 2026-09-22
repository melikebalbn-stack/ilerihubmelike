import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  personelAtamaFindMany: vi.fn(),
  aracVarsayilanFindMany: vi.fn(),
  soforVarsayilanFindMany: vi.fn(),
  guzergahDurakFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servisPersonelAtama: { findMany: mocks.personelAtamaFindMany },
    servisGuzergahAracVarsayilan: { findMany: mocks.aracVarsayilanFindMany },
    servisGuzergahSoforVarsayilan: { findMany: mocks.soforVarsayilanFindMany },
    servisGuzergahDurak: { findMany: mocks.guzergahDurakFindMany },
  },
}))

import { operasyonelServisListesiGetir } from './operasyonel-servis-listesi'

function ornekAtama(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    guzergahId: 'g1',
    durakId: 'd1',
    personnel: { id: 'p1', sicilNo: '111', adSoyad: 'Ahmet Yılmaz', bolum: 'Üretim', telefon: '5551112233' },
    guzergah: { kod: 'G1', ad: 'Güzergah 1' },
    durak: { kod: 'D1', ad: 'Durak 1' },
    ...overrides,
  }
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
  mocks.personelAtamaFindMany.mockResolvedValue([])
  mocks.aracVarsayilanFindMany.mockResolvedValue([])
  mocks.soforVarsayilanFindMany.mockResolvedValue([])
  mocks.guzergahDurakFindMany.mockResolvedValue([])
})

describe('operasyonelServisListesiGetir — tekil filtreler', () => {
  it('tarih verilmezse bugün kullanılır, gecmisTarihSecildi=false', async () => {
    const sonuc = await operasyonelServisListesiGetir()
    const bugun = new Date().toISOString().slice(0, 10)
    expect(sonuc.tarih).toBe(bugun)
    expect(sonuc.gecmisTarihSecildi).toBe(false)
  })

  it('guzergahId filtresi where clause\'a doğru şekilde eklenir', async () => {
    await operasyonelServisListesiGetir({ guzergahId: 'g1' })
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where.guzergahId).toBe('g1')
  })

  it('durakId filtresi where clause\'a doğru şekilde eklenir', async () => {
    await operasyonelServisListesiGetir({ durakId: 'd1' })
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where.durakId).toBe('d1')
  })

  it('bolum filtresi personnel ilişkisi üzerinden uygulanır', async () => {
    await operasyonelServisListesiGetir({ bolum: 'Üretim' })
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where.personnel).toEqual({ bolum: 'Üretim' })
  })

  it('yerleskeId (lokasyon) filtresi guzergah ilişkisi üzerinden uygulanır', async () => {
    await operasyonelServisListesiGetir({ yerleskeId: 'y1' })
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where.guzergah).toEqual({ yerleskeId: 'y1' })
  })

  // dilimId — madde 49 (Acil Durum) için eklenen OPSİYONEL filtre.
  it('dilimId verilmezse where\'e dilim anahtarı HİÇ eklenmez (madde 29 varsayılan davranışı birebir korunur)', async () => {
    await operasyonelServisListesiGetir({ guzergahId: 'g1' })
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(Object.prototype.hasOwnProperty.call(cagriArg.where, 'dilimler')).toBe(false)
  })

  it('dilimId verilirse atamanın o dilimi kapsaması şartı eklenir (ServisPersonelAtamaDilim)', async () => {
    await operasyonelServisListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where.dilimler).toEqual({ some: { dilimId: 'd-sabah' } })
    // Diğer filtreler etkilenmez.
    expect(cagriArg.where.guzergahId).toBe('g1')
  })

  it('firmaId filtresi — araç/şoför varsayılanları üzerinden dolaylı, ilgili güzergahlarla sınırlar', async () => {
    mocks.aracVarsayilanFindMany.mockResolvedValue([{ guzergahId: 'g1' }])
    mocks.soforVarsayilanFindMany.mockResolvedValue([{ guzergahId: 'g2' }])

    await operasyonelServisListesiGetir({ firmaId: 'f1', tarih: '2026-06-01' })

    expect(mocks.aracVarsayilanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          rol: 'ANA',
          baslangicTarihi: { lte: new Date('2026-06-01T00:00:00.000Z') },
          OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: new Date('2026-06-01T00:00:00.000Z') } }],
          arac: { firmaId: 'f1' },
        },
      }),
    )
    expect(mocks.soforVarsayilanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          rol: 'ANA',
          baslangicTarihi: { lte: new Date('2026-06-01T00:00:00.000Z') },
          OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: new Date('2026-06-01T00:00:00.000Z') } }],
          sofor: { firmaId: 'f1' },
        },
      }),
    )
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where.guzergahId).toEqual({ in: expect.arrayContaining(['g1', 'g2']) })
  })

  it("firmaId filtresi point-in-time'dır — aktif bayrağına DEĞİL, verilen tarihe göre kurulur (madde 31/2 sınıfı hata)", async () => {
    await operasyonelServisListesiGetir({ firmaId: 'f1', tarih: '2026-06-01' })

    const aracCagri = mocks.aracVarsayilanFindMany.mock.calls[0][0]
    const soforCagri = mocks.soforVarsayilanFindMany.mock.calls[0][0]
    expect(aracCagri.where.aktif).toBeUndefined()
    expect(soforCagri.where.aktif).toBeUndefined()
  })
})

describe('operasyonelServisListesiGetir — birleşik filtre', () => {
  it('birden fazla filtre aynı anda where clause\'a eklenir', async () => {
    await operasyonelServisListesiGetir({ guzergahId: 'g1', durakId: 'd1', bolum: 'Kalite', yerleskeId: 'y1' })
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where).toMatchObject({
      guzergahId: 'g1',
      durakId: 'd1',
      personnel: { bolum: 'Kalite' },
      guzergah: { yerleskeId: 'y1' },
    })
  })
})

describe('operasyonelServisListesiGetir — point-in-time', () => {
  it('sorgu aktif bayrağına BAKMAZ — yalnız tarih aralığı kontrol edilir', async () => {
    await operasyonelServisListesiGetir({ tarih: '2026-06-01' })
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where.aktif).toBeUndefined()
    expect(cagriArg.where.baslangicTarihi).toEqual({ lte: new Date('2026-06-01T00:00:00.000Z') })
    expect(cagriArg.where.OR).toEqual([
      { bitisTarihi: null },
      { bitisTarihi: { gte: new Date('2026-06-01T00:00:00.000Z') } },
    ])
  })

  it('geçmiş tarihte aktif olan ama bugün pasifleşmiş (aktif=false) bir atama satırı da mock üzerinden döndürülüp doğru işlenir', async () => {
    // Mock, gerçek DB sorgusunun aktif=false satırları da (tarih aralığı uyduğunda)
    // döndürdüğü senaryoyu simüle ediyor — where clause'da aktif filtresi
    // OLMADIĞI için bu satır gerçek sorguda da gelir.
    mocks.personelAtamaFindMany.mockResolvedValue([
      ornekAtama({ personnel: { id: 'p2', sicilNo: '222', adSoyad: 'Geçmiş Personel', bolum: 'Üretim', telefon: null } }),
    ])
    const sonuc = await operasyonelServisListesiGetir({ tarih: '2026-02-15' })
    expect(sonuc.satirlar).toHaveLength(1)
    expect(sonuc.satirlar[0].adSoyad).toBe('Geçmiş Personel')
  })

  it('geçmiş tarih seçildiğinde gecmisTarihSecildi=true döner', async () => {
    const sonuc = await operasyonelServisListesiGetir({ tarih: '2020-01-01' })
    expect(sonuc.gecmisTarihSecildi).toBe(true)
    expect(sonuc.tarih).toBe('2020-01-01')
  })

  it('bugünün tarihi verildiğinde gecmisTarihSecildi=false döner', async () => {
    const bugun = new Date().toISOString().slice(0, 10)
    const sonuc = await operasyonelServisListesiGetir({ tarih: bugun })
    expect(sonuc.gecmisTarihSecildi).toBe(false)
  })
})

describe('operasyonelServisListesiGetir — KVKK', () => {
  it('Personnel select yalnız gerekli alanları içerir (id/sicilNo/adSoyad/bolum/telefon)', async () => {
    await operasyonelServisListesiGetir()
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.select.personnel).toEqual({
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, telefon: true },
    })
  })
})

describe('operasyonelServisListesiGetir — Sabah Saati', () => {
  it('durakId olan atama satırı için GIDIS dilimindeki saat eşlenir', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([ornekAtama()])
    mocks.guzergahDurakFindMany.mockResolvedValue([
      { guzergahId: 'g1', durakId: 'd1', saatler: [{ saat: '07:15' }] },
    ])

    const sonuc = await operasyonelServisListesiGetir()
    expect(sonuc.satirlar[0].sabahSaati).toBe('07:15')
    expect(mocks.guzergahDurakFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guzergahId: { in: ['g1'] }, durakId: { in: ['d1'] }, aktif: true },
        select: expect.objectContaining({
          saatler: { where: { aktif: true, dilim: { yon: 'GIDIS' } }, select: { saat: true }, take: 1 },
        }),
      }),
    )
  })

  it('durakId yoksa (durak atanmamış) sabahSaati null döner, guzergahDurak sorgusu o kayıt için çalışmaz', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([
      ornekAtama({ durakId: null, durak: null }),
    ])
    const sonuc = await operasyonelServisListesiGetir()
    expect(sonuc.satirlar[0].sabahSaati).toBeNull()
    expect(sonuc.satirlar[0].durakKod).toBeNull()
  })

  it('GIDIS dilimi için aktif saat kaydı yoksa sabahSaati null döner', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([ornekAtama()])
    mocks.guzergahDurakFindMany.mockResolvedValue([{ guzergahId: 'g1', durakId: 'd1', saatler: [] }])

    const sonuc = await operasyonelServisListesiGetir()
    expect(sonuc.satirlar[0].sabahSaati).toBeNull()
  })
})

describe('operasyonelServisListesiGetir — telefon dahil', () => {
  it('Telefon alanı satırda dolu döner (bu listede KVKK gereği ÇIKARILMAZ)', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([ornekAtama()])
    const sonuc = await operasyonelServisListesiGetir()
    expect(sonuc.satirlar[0].telefon).toBe('5551112233')
  })
})
