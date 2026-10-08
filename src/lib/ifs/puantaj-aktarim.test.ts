import { beforeAll, describe, expect, it } from 'vitest'
import { IFS_ALAN_ESLEME, aktarimAktif, ifsPuantajPayload, ifsPuantajYaz, type IfsPuantajGirdi } from './puantaj-aktarim'

// getIfsConfig env'i çağrı anında okur; testten önce zorunlu alanları doldur.
beforeAll(() => {
  process.env.IFS_INT_BASE_URL = 'https://ifs.example/ifsapplications/projection/v1/ShopFloorService.svc'
  process.env.IFS_TOKEN_URL = 'https://ifs.example/token'
  process.env.IFS_CLIENT_ID = 'x'
  process.env.IFS_CLIENT_SECRET = 'y'
})

const girdi: IfsPuantajGirdi = {
  empNo: 'ILR-01104',
  donem: '2026-09',
  calismaSaat: 198.5,
  fazlaMesaiSaat: 12,
  geceSaat: 45,
  normalGun: 22,
  haftaTatiliGun: 4,
  resmiTatilGun: 1,
  izinGun: 1.5,
  raporGun: 0,
  eksikGun: 1,
}

// İK kararı: maaş/ücret alanı ASLA gönderilmez. Regresyon kalkanı.
const UCRET_DESENI = /^(TEk|TKes|Ucret|NetBrut|Brut|Net|Maas|Odeme)/i

describe('ifsPuantajPayload — yalnız devam, ücret yok', () => {
  it('kimlik + dönem alanlarını koyar', () => {
    const p = ifsPuantajPayload(girdi)
    expect(p).toMatchObject({ EmpNo: 'ILR-01104', PayYear: 2026, PayPeriod: 9, Company: expect.any(String) })
  })

  it('devam alanlarını eşlemeye göre koyar', () => {
    const p = ifsPuantajPayload(girdi)
    expect(p[IFS_ALAN_ESLEME.calismaSaat]).toBe(198.5)
    expect(p[IFS_ALAN_ESLEME.geceSaat]).toBe(45)
    expect(p[IFS_ALAN_ESLEME.eksikGun]).toBe(1)
    expect(p[IFS_ALAN_ESLEME.izinGun]).toBe(1.5)
  })

  it('HİÇBİR ücret/maaş alanı içermez', () => {
    const p = ifsPuantajPayload(girdi)
    for (const k of Object.keys(p)) expect(UCRET_DESENI.test(k), `ücret alanı sızdı: ${k}`).toBe(false)
  })

  it('eşlemede ücret alanı tanımlı değil', () => {
    for (const ifsKolon of Object.values(IFS_ALAN_ESLEME)) expect(UCRET_DESENI.test(ifsKolon)).toBe(false)
  })
})

describe('aktarimAktif / ifsPuantajYaz guard', () => {
  it('env kapalıyken aktif değil ve yazım reddedilir', async () => {
    delete process.env.IFS_PUANTAJ_AKTARIM_AKTIF
    expect(aktarimAktif()).toBe(false)
    await expect(ifsPuantajYaz(girdi)).rejects.toThrow(/kapalı/)
  })

  it('env=1 iken aktif', () => {
    process.env.IFS_PUANTAJ_AKTARIM_AKTIF = '1'
    expect(aktarimAktif()).toBe(true)
    delete process.env.IFS_PUANTAJ_AKTARIM_AKTIF
  })
})
