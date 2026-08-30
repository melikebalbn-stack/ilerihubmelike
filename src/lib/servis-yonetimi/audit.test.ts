import { describe, expect, it, vi } from 'vitest'
import { degisenAlanlar, kaydetIslemGecmisi } from './audit'

describe('degisenAlanlar', () => {
  it('yalnız fiilen değişen alanları döner, değişmeyenleri atlar', () => {
    const eski = { ad: 'Eski Ad', telefon: '111', eposta: 'a@b.com' }
    const yeni = { ad: 'Yeni Ad', telefon: '111', eposta: 'a@b.com' }
    const fark = degisenAlanlar(eski, yeni, ['ad', 'telefon', 'eposta'])
    expect(fark).toEqual({ oncekiDeger: { ad: 'Eski Ad' }, yeniDeger: { ad: 'Yeni Ad' } })
  })

  it('Regresyon: Prisma.Decimal (enlem/boylam) ile plain number aynı değeri temsil ediyorsa "değişmedi" sayılır', () => {
    // Prisma.Decimal duck-type: toNumber() metodu var. JSON.stringify farklı
    // temsiller üretir (Decimal→string, number→number) — normalize edilmezse
    // yanlışlıkla "değişti" sayılırdı.
    const sahteDecimal = { toNumber: () => 40.123456, toString: () => '40.123456' }
    const eski = { enlem: sahteDecimal as unknown as number }
    const yeni = { enlem: 40.123456 }
    expect(degisenAlanlar(eski, yeni, ['enlem'])).toBeNull()
  })

  it('Decimal ↔ number GERÇEKTEN farklı değerdeyse yine de yakalanır', () => {
    const sahteDecimal = { toNumber: () => 40.1, toString: () => '40.1' }
    const eski = { enlem: sahteDecimal as unknown as number }
    const yeni = { enlem: 40.9 }
    const fark = degisenAlanlar(eski, yeni, ['enlem'])
    expect(fark).not.toBeNull()
    expect(fark?.yeniDeger.enlem).toBe(40.9)
  })

  it('hiçbir alan değişmediyse null döner', () => {
    const eski = { ad: 'Aynı', telefon: '111' }
    const yeni = { ad: 'Aynı', telefon: '111' }
    expect(degisenAlanlar(eski, yeni, ['ad', 'telefon'])).toBeNull()
  })

  it('yeni nesnede bulunmayan alanları değerlendirmez (kısmi güncelleme)', () => {
    const eski = { ad: 'Eski', telefon: '111' }
    const yeni = { ad: 'Eski' } // telefon hiç gönderilmedi
    expect(degisenAlanlar(eski, yeni, ['ad', 'telefon'])).toBeNull()
  })

  it('null ↔ değer değişimini yakalar (örn. bitisTarihi null → Date)', () => {
    const eski = { bitisTarihi: null as Date | null }
    const yeni = { bitisTarihi: new Date('2026-01-15') }
    const fark = degisenAlanlar(eski, yeni, ['bitisTarihi'])
    expect(fark).not.toBeNull()
    expect(fark?.oncekiDeger.bitisTarihi).toBeNull()
    expect(fark?.yeniDeger.bitisTarihi).toEqual(new Date('2026-01-15'))
  })

  it('birden fazla alan değiştiğinde hepsini döner', () => {
    const eski = { ad: 'A', telefon: '1', eposta: 'x' }
    const yeni = { ad: 'B', telefon: '2', eposta: 'x' }
    const fark = degisenAlanlar(eski, yeni, ['ad', 'telefon', 'eposta'])
    expect(fark).toEqual({
      oncekiDeger: { ad: 'A', telefon: '1' },
      yeniDeger: { ad: 'B', telefon: '2' },
    })
  })
})

describe('kaydetIslemGecmisi', () => {
  it('tx.servisIslemGecmisi.create çağırır, boş yapanId null yazılır', async () => {
    const create = vi.fn()
    const tx = { servisIslemGecmisi: { create } } as unknown as Parameters<typeof kaydetIslemGecmisi>[0]['tx']
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'FIRMA', hedefId: 'f1', islem: 'OLUSTURMA', yapanId: null,
      yeniDeger: { ad: 'Test' },
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        hedefTipi: 'FIRMA',
        hedefId: 'f1',
        islem: 'OLUSTURMA',
        userId: null,
        oncekiDeger: undefined,
        yeniDeger: { ad: 'Test' },
        aciklama: null,
      },
    })
  })
})
