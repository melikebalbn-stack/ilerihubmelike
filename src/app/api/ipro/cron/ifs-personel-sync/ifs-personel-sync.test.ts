/**
 * IFS personel senkronu testleri (integration — gerçek dev DB, IFS HTTP MOCK'lu).
 *
 * IFS'e HİÇBİR gerçek istek gitmez: '@/lib/ifs/personel' tümüyle mock'lu.
 * Senkron tabloyu GLOBAL tarar → assertion'lar YALNIZ bu testin kurduğu
 * TSY-* sicillerine bakar, global sayımlara güvenmez.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const ifs = vi.hoisted(() => {
  // Katmanı OLMAYAN siciller (get* null döner → create tetiklenir).
  const eksik = new Set<string>()
  // sicil → create'te fırlatılacak hata detayı
  const hatalar = new Map<string, string>()
  const siteler: Array<{ employeeId: string; objstate: string }> = []
  const cagrilar = {
    createPerson: [] as Array<{ empNo: string; orgCode: string; posCode: string; fname: string; lname: string }>,
    createSfe: [] as string[],
    createSite: [] as Array<{ empNo: string; laborClass: string }>,
    block: [] as string[],
  }
  return { eksik, hatalar, siteler, cagrilar }
})

vi.mock('@/lib/ifs/personel', () => {
  class IfsPersonelError extends Error {
    constructor(
      public readonly status: number,
      public readonly detay: string,
    ) {
      super(detay)
      this.name = 'IfsPersonelError'
    }
  }
  const patlat = (empNo: string) => {
    const d = ifs.hatalar.get(empNo)
    if (d) throw new IfsPersonelError(400, d)
  }
  // Bilinmeyen sicil → katman VAR say (gerçek dev verisi 'atlanan'a düşsün, create tetiklemesin).
  const varMi = (empNo: string) => (ifs.eksik.has(empNo) ? null : { EmpNo: empNo })

  return {
    IfsPersonelError,
    pencereHatasiMi: (d: string) =>
      /ORGCODENOTVALID|CompanyPersAssign\.NOTVALID|not valid during entered date interval/i.test(d),
    listOrganizations: async () => [
      { orgCode: '900', orgName: 'TEST MONTAJ' },
      { orgCode: '202', orgName: 'Mekanik Montaj' },
    ],
    listPositions: async () => [
      { posCode: '900901', positionTitle: 'TEST OPERATÖRÜ' },
      { posCode: '100151', positionTitle: 'MONTAJ OPERATÖRÜ' },
    ],
    listShopFloorEmployeeSites: async () => ifs.siteler,
    getCompanyPerson: async (e: string) => varMi(e),
    getShopFloorEmployee: async (e: string) => varMi(e),
    getShopFloorEmployeeSite: async (e: string) => varMi(e),
    createCompanyPerson: async (g: { empNo: string; orgCode: string; posCode: string; fname: string; lname: string }) => {
      patlat(g.empNo)
      ifs.cagrilar.createPerson.push(g)
      return {}
    },
    createShopFloorEmployee: async (e: string) => {
      patlat(e)
      ifs.cagrilar.createSfe.push(e)
      return {}
    },
    createShopFloorEmployeeSite: async (e: string, laborClass: string) => {
      patlat(e)
      ifs.cagrilar.createSite.push({ empNo: e, laborClass })
      return {}
    },
    blockShopFloorEmployeeSite: async (e: string) => {
      ifs.cagrilar.block.push(e)
      return {}
    },
  }
})

import { prisma } from '@/lib/prisma'
import { ifsPersonelSenkronu, type SenkronSonuc } from '@/lib/ipro/ifs-personel-sync'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo'

// Kurulacak personeller. bolum/gorev kasten karışık kutulu — normalize() sınanıyor.
const KISILER = [
  { sicilNo: 'TSY-001', adSoyad: 'AHMET TEST YILMAZ', bolum: 'test montaj', gorev: 'test operatörü', operator: true },
  { sicilNo: 'TSY-002', adSoyad: 'BURAK TEST', bolum: 'OLMAYAN BÖLÜM XYZ', gorev: 'TEST OPERATÖRÜ', operator: true },
  { sicilNo: 'TSY-003', adSoyad: 'CEM TEST', bolum: 'TEST MONTAJ', gorev: 'OLMAYAN GÖREV XYZ', operator: true },
  { sicilNo: 'TSY-004', adSoyad: 'DENIZ TEST', bolum: 'TEST MONTAJ', gorev: 'TEST OPERATÖRÜ', operator: true },
  { sicilNo: 'TSY-005', adSoyad: 'EMRE TEST', bolum: 'TEST MONTAJ', gorev: 'TEST OPERATÖRÜ', operator: true },
  // Operatör eşlemesi YOK → aday değil; IFS'te Active site'ı var → pasifleştirilmeli.
  { sicilNo: 'TSY-006', adSoyad: 'FURKAN TEST', bolum: 'TEST MONTAJ', gorev: 'TEST OPERATÖRÜ', operator: false },
]

let sonuc: SenkronSonuc
const olusanIds: string[] = []

beforeAll(async () => {
  for (const k of KISILER) {
    const p = await prisma.personnel.create({
      data: {
        sicilNo: k.sicilNo,
        adSoyad: k.adSoyad,
        cinsiyet: 'MALE',
        yakaRengi: 'MAVI',
        iseGirisTarihi: new Date('2020-03-15'),
        bolum: k.bolum,
        gorev: k.gorev,
        aktif: true,
      },
      select: { id: true },
    })
    olusanIds.push(p.id)
    if (k.operator) {
      await prisma.iproOperatorTezgah.create({
        data: { personnelId: p.id, tezgahId: MM63_ID, aktif: true, kaynak: 'TEST' },
      })
    }
  }

  // TSY-001/004/005 → katmanları eksik. 005 yalnız 3. katmanı eksik değil: hepsi VAR (atlanan).
  ifs.eksik.add('TSY-001')
  ifs.eksik.add('TSY-004')
  // TSY-004 katman 1'de geçerlilik penceresi hatası alır.
  ifs.hatalar.set('TSY-004', 'ORGCODENOTVALID: Org code is not valid during entered date interval')

  ifs.siteler.push(
    { employeeId: 'TSY-006', objstate: 'Active' }, // bilinen sicil, aday değil → block
    { employeeId: 'TSY-005', objstate: 'Active' }, // hâlâ aday → dokunma
    { employeeId: 'IG002', objstate: 'Active' }, // ILERIHub dışı → ASLA dokunma
  )

  sonuc = await ifsPersonelSenkronu()
})

afterAll(async () => {
  await prisma.iproOperatorTezgah.deleteMany({ where: { personnelId: { in: olusanIds } } })
  await prisma.personnel.deleteMany({ where: { id: { in: olusanIds } } })
  await prisma.$disconnect()
})

describe('ifsPersonelSenkronu — katman kurulumu', () => {
  it('eksik katmanlı operatör için üç katman da yaratılır', () => {
    const p = ifs.cagrilar.createPerson.find((c) => c.empNo === 'TSY-001')
    expect(p).toBeTruthy()
    expect(ifs.cagrilar.createSfe).toContain('TSY-001')
    expect(ifs.cagrilar.createSite.find((c) => c.empNo === 'TSY-001')?.laborClass).toBe('WMM')
  })

  it('bolum/gorev büyük-küçük ve aksan farkına rağmen eşleşir', () => {
    const p = ifs.cagrilar.createPerson.find((c) => c.empNo === 'TSY-001')
    expect(p?.orgCode).toBe('900')
    expect(p?.posCode).toBe('900901')
  })

  it('adSoyad son token soyad olacak şekilde bölünür', () => {
    const p = ifs.cagrilar.createPerson.find((c) => c.empNo === 'TSY-001')
    expect(p?.fname).toBe('AHMET TEST')
    expect(p?.lname).toBe('YILMAZ')
  })

  it('üç katmanı da olan operatöre yazma yapılmaz', () => {
    expect(ifs.cagrilar.createPerson.some((c) => c.empNo === 'TSY-005')).toBe(false)
    expect(ifs.cagrilar.createSfe).not.toContain('TSY-005')
  })
})

describe('ifsPersonelSenkronu — eşleşmeyenler', () => {
  it('bölümü eşleşmeyen ATLANIR ve IFS’e hiç dokunulmaz', () => {
    const e = sonuc.eslesmeyenler.find((x) => x.sicilNo === 'TSY-002')
    expect(e).toMatchObject({ alan: 'bolum', deger: 'OLMAYAN BÖLÜM XYZ' })
    expect(ifs.cagrilar.createPerson.some((c) => c.empNo === 'TSY-002')).toBe(false)
  })

  it('görevi eşleşmeyen ATLANIR', () => {
    const e = sonuc.eslesmeyenler.find((x) => x.sicilNo === 'TSY-003')
    expect(e).toMatchObject({ alan: 'gorev', deger: 'OLMAYAN GÖREV XYZ' })
    expect(ifs.cagrilar.createPerson.some((c) => c.empNo === 'TSY-003')).toBe(false)
  })
})

describe('ifsPersonelSenkronu — hata sınıflandırması', () => {
  it('geçerlilik penceresi hatası ayrı kovaya düşer, hatalilar’a değil', () => {
    expect(sonuc.pencereHatalilar.some((x) => x.sicilNo === 'TSY-004')).toBe(true)
    expect(sonuc.hatalilar.some((x) => x.sicilNo === 'TSY-004')).toBe(false)
  })
})

describe('ifsPersonelSenkronu — pasifleştirme', () => {
  it('yetkisi kalkan bilinen sicil SetBlocked edilir', () => {
    expect(ifs.cagrilar.block).toContain('TSY-006')
  })

  it('hâlâ aday olan sicile dokunulmaz', () => {
    expect(ifs.cagrilar.block).not.toContain('TSY-005')
  })

  it('ILERIHub dışı sicile (IG002) ASLA dokunulmaz', () => {
    expect(ifs.cagrilar.block).not.toContain('IG002')
  })
})
