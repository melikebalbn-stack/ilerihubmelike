import { describe, it, expect } from 'vitest'
import { malzemeMapla, KATALOG_SABIT, BIRIM_HARITASI, type MalzemeGirdi, type MalzemeReferans } from './malzeme-mapper'

const REF: MalzemeReferans = {
  birimler: ['ad', 'kg', 'm', 'l', 'g', 'pkg'],
  muhasebeGruplari: ['30011', '153', '490'],
  urunKodlari: ['150', '151', '152', '153', '154'], // IFS Reference_InventoryProductCode
  contract: 'ILER2',
}
const temel: MalzemeGirdi = {
  item: 'ABC-1', description: 'Test Parça', u_m: 'ad', product_code: '1530103', p_m_t_code: 'M', family_code: '30011',
}
const ok = (r: ReturnType<typeof malzemeMapla>) => {
  if ('hata' in r) throw new Error('beklenen başarı, hata döndü: ' + r.hata)
  return r
}

describe('malzemeMapla — Syteline → IFS eşleme', () => {
  it('tam geçerli satır → katalog + envanter + hash', () => {
    const r = ok(malzemeMapla(temel, REF))
    expect(r.katalog.PartNo).toBe('ABC-1')
    expect(r.katalog.Description).toBe('Test Parça')
    expect(r.katalog.UnitCode).toBe('ad')
    expect(r.katalog.ConditionCodeUsage).toBe(KATALOG_SABIT.ConditionCodeUsage)
    expect(r.katalog.StandardName).toBe('*')
    expect(r.envanter.Contract).toBe('ILER2')
    expect(r.envanter.UnitMeas).toBe('ad')
    expect(r.envanter.PartProductCode).toBe('153')
    expect(r.envanter.AccountingGroup).toBe('30011')
    expect(r.envanter.PartStatus).toBe('A')
    expect(r.envanter.PlannerBuyer).toBe('*')
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('TypeCode: p_m_t_code=M → Manufactured', () => {
    expect(ok(malzemeMapla({ ...temel, p_m_t_code: 'M' }, REF)).envanter.TypeCode).toBe('Manufactured')
  })
  it('TypeCode: p_m_t_code≠M (P) → PurchasedRaw', () => {
    expect(ok(malzemeMapla({ ...temel, p_m_t_code: 'P' }, REF)).envanter.TypeCode).toBe('PurchasedRaw')
  })
  it('TypeCode: p_m_t_code boş → PurchasedRaw', () => {
    expect(ok(malzemeMapla({ ...temel, p_m_t_code: null }, REF)).envanter.TypeCode).toBe('PurchasedRaw')
  })

  it("family_code IFS grubunda → aynen kullanılır", () => {
    expect(ok(malzemeMapla({ ...temel, family_code: '490' }, REF)).envanter.AccountingGroup).toBe('490')
  })
  it("family_code IFS grubunda YOK → '*' fallback", () => {
    expect(ok(malzemeMapla({ ...temel, family_code: '99999' }, REF)).envanter.AccountingGroup).toBe('*')
  })
  it("family_code boş → '*' fallback", () => {
    expect(ok(malzemeMapla({ ...temel, family_code: null }, REF)).envanter.AccountingGroup).toBe('*')
  })

  it('birim IFS listesinde yok → hata "birim yok: X"', () => {
    const r = malzemeMapla({ ...temel, u_m: 'XYZ' }, REF)
    expect(r).toEqual({ hata: 'birim yok: XYZ' })
  })
  it('birim büyük harf → küçük harfe indirgenir ve eşleşir', () => {
    const r = ok(malzemeMapla({ ...temel, u_m: 'AD' }, REF))
    expect(r.envanter.UnitMeas).toBe('ad')
  })
  it('BIRIM_HARITASI: LT → l, PKT → pkg, GR → g (haritadan IFS koduna)', () => {
    expect(BIRIM_HARITASI.LT).toBe('l')
    expect(ok(malzemeMapla({ ...temel, u_m: 'LT' }, REF)).envanter.UnitMeas).toBe('l')
    expect(ok(malzemeMapla({ ...temel, u_m: 'PKT' }, REF)).envanter.UnitMeas).toBe('pkg')
    expect(ok(malzemeMapla({ ...temel, u_m: 'GR' }, REF)).katalog.UnitCode).toBe('g')
  })
  it('BIRIM_HARITASI: RU/TOP eşlenir ama IFS LOV’da yoksa yine "birim yok"', () => {
    // ru/top REF.birimler'de değil → harita uygulanır ama LOV kontrolü eler.
    expect(malzemeMapla({ ...temel, u_m: 'RU' }, REF)).toEqual({ hata: 'birim yok: RU' })
  })

  it('ilk 3 hane: product_code 1510101 → PartProductCode 151', () => {
    const r = ok(malzemeMapla({ ...temel, product_code: '1510101' }, REF))
    expect(r.envanter.PartProductCode).toBe('151')
  })
  it('ilk 3 hane: farklı buketler (1520103→152, 1540103→154)', () => {
    expect(ok(malzemeMapla({ ...temel, product_code: '1520103' }, REF)).envanter.PartProductCode).toBe('152')
    expect(ok(malzemeMapla({ ...temel, product_code: '1540103' }, REF)).envanter.PartProductCode).toBe('154')
  })
  it('ilk 3 hane IFS LOV’da yoksa → "ürün kodu yok: 999" (9999→999)', () => {
    expect(malzemeMapla({ ...temel, product_code: '9999' }, REF)).toEqual({ hata: 'ürün kodu yok: 999' })
  })
  it('3 haneden kısa → "ürün kodu geçersiz"', () => {
    const r = malzemeMapla({ ...temel, product_code: '15' }, REF)
    expect('hata' in r && r.hata.startsWith('ürün kodu geçersiz')).toBe(true)
  })
  it('ilk 3 hane rakam-dışı → "ürün kodu geçersiz"', () => {
    const r = malzemeMapla({ ...temel, product_code: 'AB1234' }, REF)
    expect('hata' in r && r.hata.startsWith('ürün kodu geçersiz')).toBe(true)
  })

  it('açıklama boş → hata', () => {
    const r = malzemeMapla({ ...temel, description: '   ' }, REF)
    expect('hata' in r && r.hata.startsWith('açıklama boş')).toBe(true)
  })
  it('item boş → hata', () => {
    const r = malzemeMapla({ ...temel, item: '  ' }, REF)
    expect(r).toEqual({ hata: 'item (PartNo) boş' })
  })

  it('hash yalnız katalog+envanter alanlarına bağlı (aynı girdi → aynı hash)', () => {
    const a = ok(malzemeMapla(temel, REF)).hash
    const b = ok(malzemeMapla({ ...temel }, REF)).hash
    expect(a).toBe(b)
  })
  it('description değişince hash değişir', () => {
    const a = ok(malzemeMapla(temel, REF)).hash
    const b = ok(malzemeMapla({ ...temel, description: 'Farklı' }, REF)).hash
    expect(a).not.toBe(b)
  })
})
