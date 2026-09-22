import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  personelFkAlanlari: vi.fn(),
  personelEklendiginde: vi.fn(),
}))

vi.mock('@/lib/personnel/fk-cozum', () => ({ personelFkAlanlari: mocks.personelFkAlanlari }))
vi.mock('@/lib/org/personel-koltuk-senkron', () => ({ personelEklendiginde: mocks.personelEklendiginde }))

import { personeleDonustur, type BasvuruKaynak } from './personele-donustur'
import type { PrismaClient } from '@/generated/prisma'

function temelBasvuru(overrides: Partial<BasvuruKaynak> = {}): BasvuruKaynak {
  return {
    id: 'app1',
    applicationNumber: 'BSV-2026-001',
    status: 'EVRAK_HAZIRLIK',
    fullName: 'Ahmet Yılmaz',
    gender: 'MALE',
    bloodType: null,
    email: null,
    mobilePhone: null,
    homeAddress: 'Yeni Adres Mah. 1. Sk.',
    tcKimlikNo: null, // tcKontrol'ün DB'ye gitmesini engelliyor (TEMIZ kısa devre)
    birthDate: null,
    educationLevel: null,
    educationHistory: null,
    shoeSize: null,
    clothingSizeUpper: null,
    clothingSizeLower: null,
    requestedPosition: null,
    availableStartDate: null,
    ...overrides,
  }
}

function mockTxOlustur(mevcutPersonel: { id: string; ikametAdresi: string | null; aktif?: boolean }) {
  const personnelUpdate = vi.fn().mockResolvedValue({ id: mevcutPersonel.id })
  const personnelFindUnique = vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if (where.id === mevcutPersonel.personnelId) {
      return Promise.resolve({ id: mevcutPersonel.id, aktif: mevcutPersonel.aktif ?? false, ikametAdresi: mevcutPersonel.ikametAdresi })
    }
    // sicilSahibi / bagliOlan ön kontrolleri — çakışma yok.
    return Promise.resolve(null)
  })

  return {
    personnel: { findUnique: personnelFindUnique, update: personnelUpdate },
    personnelSensitive: { upsert: vi.fn().mockResolvedValue({}) },
    employmentPeriod: { create: vi.fn().mockResolvedValue({}) },
    publicJobApplication: { update: vi.fn().mockResolvedValue({}) },
    publicJobApplicationStageLog: { create: vi.fn().mockResolvedValue({}) },
    personnelAccessLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

function mockPrismaOlustur(tx: ReturnType<typeof mockTxOlustur>) {
  return {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  } as unknown as PrismaClient
}

const HIYERARSI_BOS = { bolumMuduru: null, birimSorumlusu: null, sorumlu2: null, sorumlu3: null }

beforeEach(() => {
  mocks.personelFkAlanlari.mockReset().mockResolvedValue({})
  mocks.personelEklendiginde.mockReset().mockResolvedValue(undefined)
})

describe('personeleDonustur — MEVCUDA_BAGLA (yeniden işe alım) — ikametAdresi değişim damgası', () => {
  it('adres GERÇEKTEN değişirse ikametAdresiDegisimTarihi set edilir', async () => {
    const tx = mockTxOlustur({ id: 'p1', personnelId: 'p1', ikametAdresi: 'Eski Adres' } as never)
    const prisma = mockPrismaOlustur(tx)

    await personeleDonustur({
      prisma,
      app: temelBasvuru({ homeAddress: 'Yeni Adres Mah. 1. Sk.' }),
      girdi: {
        sicilNo: '1001',
        yakaRengi: 'MAVI',
        bolum: 'Üretim',
        gorev: 'Operatör',
        iseGirisTarihi: '2026-01-15',
        direktEndirekt: 'DIREKT',
      } as never,
      karar: { tip: 'MEVCUDA_BAGLA', personnelId: 'p1' },
      actorId: 'u1',
      ipAddress: null,
      hiyerarsi: HIYERARSI_BOS,
    })

    expect(tx.personnel.update).toHaveBeenCalledTimes(1)
    const gonderilenVeri = tx.personnel.update.mock.calls[0][0].data
    expect(gonderilenVeri.ikametAdresi).toBe('Yeni Adres Mah. 1. Sk.')
    expect(gonderilenVeri.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
  })

  it('adres DEĞİŞMEDEN gelen başvuruda (aynı değer) damgaya DOKUNULMAZ', async () => {
    const AYNI_ADRES = 'Aynı Adres Mah. 2. Sk.'
    const tx = mockTxOlustur({ id: 'p1', personnelId: 'p1', ikametAdresi: AYNI_ADRES } as never)
    const prisma = mockPrismaOlustur(tx)

    await personeleDonustur({
      prisma,
      app: temelBasvuru({ homeAddress: AYNI_ADRES }),
      girdi: {
        sicilNo: '1001',
        yakaRengi: 'MAVI',
        bolum: 'Üretim',
        gorev: 'Operatör',
        iseGirisTarihi: '2026-01-15',
        direktEndirekt: 'DIREKT',
      } as never,
      karar: { tip: 'MEVCUDA_BAGLA', personnelId: 'p1' },
      actorId: 'u1',
      ipAddress: null,
      hiyerarsi: HIYERARSI_BOS,
    })

    const gonderilenVeri = tx.personnel.update.mock.calls[0][0].data
    expect(gonderilenVeri.ikametAdresiDegisimTarihi).toBeUndefined()
  })
})
