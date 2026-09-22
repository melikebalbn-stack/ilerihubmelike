import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  personnelFindUnique: vi.fn(),
  personelFkAlanlariIdOncelikli: vi.fn(),
}))

vi.mock('@/lib/personnel/fk-cozum', () => ({
  personelFkAlanlariIdOncelikli: mocks.personelFkAlanlariIdOncelikli,
}))

import { personelPutGovdesiniHazirla } from './put-govde'

function fakeDb() {
  return { personnel: { findUnique: mocks.personnelFindUnique } } as unknown as Parameters<typeof personelPutGovdesiniHazirla>[0]
}

beforeEach(() => {
  mocks.personnelFindUnique.mockReset()
  mocks.personelFkAlanlariIdOncelikli.mockReset()
  mocks.personelFkAlanlariIdOncelikli.mockResolvedValue({})
})

describe('personelPutGovdesiniHazirla — ikametAdresiDegisimTarihi (Melih kararı, 22.09.2026)', () => {
  it('adres GERÇEKTEN değişirse ikametAdresiDegisimTarihi now() olarak yazılır', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ ikametAdresi: 'Eski Mah. 1. Sk. No:1' })

    const { data } = await personelPutGovdesiniHazirla(fakeDb(), { ikametAdresi: 'Yeni Mah. 2. Sk. No:2' }, 'p1')

    expect(data.ikametAdresi).toBe('Yeni Mah. 2. Sk. No:2')
    expect(data.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
    expect(mocks.personnelFindUnique).toHaveBeenCalledWith({ where: { id: 'p1' }, select: { ikametAdresi: true } })
  })

  it('adres DEĞİŞMEDEN gelen PUT (aynı değer) alana DOKUNMAZ — no-op', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ ikametAdresi: 'Aynı Adres' })

    const { data } = await personelPutGovdesiniHazirla(fakeDb(), { ikametAdresi: 'Aynı Adres' }, 'p1')

    expect(data.ikametAdresiDegisimTarihi).toBeUndefined()
  })

  it('trim sonrası eşitse (baştaki/sondaki boşluk farkı) değişiklik SAYILMAZ', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ ikametAdresi: 'Aynı Adres' })

    const { data } = await personelPutGovdesiniHazirla(fakeDb(), { ikametAdresi: '  Aynı Adres  ' }, 'p1')

    expect(data.ikametAdresiDegisimTarihi).toBeUndefined()
  })

  it('ikametAdresi gövdede HİÇ gönderilmemişse (kısmi güncelleme) damgaya dokunulmaz, existing sorgulanmaz', async () => {
    const { data } = await personelPutGovdesiniHazirla(fakeDb(), { adSoyad: 'Ahmet Yılmaz' }, 'p1')

    expect(data.ikametAdresiDegisimTarihi).toBeUndefined()
    expect(mocks.personnelFindUnique).not.toHaveBeenCalled()
  })

  it('boş string gönderilip adres null\'a çevrildiğinde ve eskiden doluysa değişiklik SAYILIR', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ ikametAdresi: 'Eski Adres' })

    const { data } = await personelPutGovdesiniHazirla(fakeDb(), { ikametAdresi: '' }, 'p1')

    expect(data.ikametAdresi).toBeNull()
    expect(data.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
  })

  it('eskiden de NULL/boş, yeni de NULL/boş ise değişiklik SAYILMAZ', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ ikametAdresi: null })

    const { data } = await personelPutGovdesiniHazirla(fakeDb(), { ikametAdresi: '' }, 'p1')

    expect(data.ikametAdresiDegisimTarihi).toBeUndefined()
  })

  it('client ikametAdresiDegisimTarihi\'ni DOĞRUDAN gönderirse yok sayılır (IZINLI_ALANLAR\'da değil, atilanAlanlar\'a düşer)', async () => {
    const sahte = new Date('2020-01-01')
    const { data, atilanAlanlar } = await personelPutGovdesiniHazirla(
      fakeDb(),
      { adSoyad: 'Ahmet Yılmaz', ikametAdresiDegisimTarihi: sahte },
      'p1',
    )

    expect(data.ikametAdresiDegisimTarihi).toBeUndefined()
    expect(atilanAlanlar).toContain('ikametAdresiDegisimTarihi')
  })
})
