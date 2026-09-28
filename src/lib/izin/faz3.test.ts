// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: async () => ({ success: true }) }))

import { ilkDurum, kararDogrula, onayYetkisi, talepHesapla, iptalEdilebilirMi, geriCekilebilirMi, formdaGorunurMu, type TurKurali } from './talep-kurallari'
import { yoneticiSatirlari, tamSatirlar } from './mail'
import { prismaIzinKaynagi } from './pdks-izin-kaynagi'

const YILLIK: TurKurali = {
  kod: 'YILLIK', ad: 'Yıllık izin', bakiyeli: true, sabitGun: null, gunSayimi: 'IS_GUNU', yarimGunOlur: true, onayAkisi: 'YONETICI_IV',
  ozelNitelikli: false, belgeZorunlu: false, kosul: null, aktif: true,
}
const tatil = new Map([['2026-10-28', { tip: 'YARIM', aciklama: 'arefe' }], ['2026-10-29', { tip: 'TATIL', aciklama: 'Cumhuriyet Bayramı' }]])
const g = (o: Partial<{ baslangic: string; bitis: string; baslangicYarim: 'SABAH' | 'OGLEDEN_SONRA' | null; bitisYarim: 'SABAH' | 'OGLEDEN_SONRA' | null }> = {}) =>
  ({ baslangic: '2026-10-26', bitis: '2026-10-30', baslangicYarim: null, bitisYarim: null, ...o })

describe('talep kuralları (saf)', () => {
  it('gün hesabı: aynı girdi → aynı sonuç (önizleme = onay); tür kuralları', () => {
    expect(talepHesapla(YILLIK, g(), tatil)).toEqual(talepHesapla(YILLIK, g(), tatil))
    expect(talepHesapla(YILLIK, g(), tatil).toplam).toBe(3.5)
    expect(() => talepHesapla({ ...YILLIK, yarimGunOlur: false, ad: 'Evlilik izni' }, g({ bitisYarim: 'SABAH' }), tatil)).toThrow(/yarım gün seçilemez/)
    expect(() => talepHesapla({ ...YILLIK, bakiyeli: false, sabitGun: 3, ad: 'Evlilik izni' }, g({ bitis: '2026-11-03' }), tatil)).toThrow(/en fazla 3 iş günü/)
    expect(() => talepHesapla({ ...YILLIK, kosul: 'DOGUM_TARIHI_GTE:2026-05-01', ad: 'Babalık izni' }, g({ baslangic: '2026-04-27', bitis: '2026-04-30' }), new Map())).toThrow(/sonrası doğumlar/)
    expect(() => talepHesapla(YILLIK, g({ baslangic: '2026-10-31', bitis: '2026-11-01' }), tatil)).toThrow(/iş günü yok/)
    expect(formdaGorunurMu({ ...YILLIK, kod: 'RAPOR', ozelNitelikli: true, belgeZorunlu: true })).toBe(false)
  })

  it('ilk durum: adına (yönetici) / muaf / YALNIZ_IV / sahipsiz → İV; normal → yönetici', () => {
    const o = { onayAkisi: 'YONETICI_IV' as const, muaf: false, yoneticiAdina: false, onaycilar: ['u1', null, null] }
    expect(ilkDurum(o)).toEqual({ durum: 'BEKLIYOR_YONETICI', atlama: null })
    expect(ilkDurum({ ...o, yoneticiAdina: true })).toEqual({ durum: 'BEKLIYOR_IV', atlama: 'YONETICI_ADINA' })
    expect(ilkDurum({ ...o, muaf: true })).toEqual({ durum: 'BEKLIYOR_IV', atlama: 'MUDUR_MUAF' })
    expect(ilkDurum({ ...o, onaycilar: [null, null, null] })).toEqual({ durum: 'BEKLIYOR_IV', atlama: 'SAHIPSIZ' })
    expect(ilkDurum({ ...o, onayAkisi: 'YALNIZ_IV' })).toEqual({ durum: 'BEKLIYOR_IV', atlama: 'YALNIZ_IV' })
  })

  it('kendini onaylama engeli her kademede; red gerekçesi zorunlu; iptal/geri çekme koşulları', () => {
    const t = { durum: 'BEKLIYOR_YONETICI', personnelId: 'p1', onayci1Id: 'u1', onayci2Id: null, onayci3Id: null }
    expect(onayYetkisi(t, { userId: 'u1', personnelId: 'p9', ivMi: false })).toEqual({ kademe: 'YONETICI' })
    expect(onayYetkisi(t, { userId: 'u1', personnelId: 'p1', ivMi: true })).toEqual({ hata: 'Kendi izin talebinizi onaylayamazsınız' })
    expect(onayYetkisi({ ...t, durum: 'BEKLIYOR_IV' }, { userId: 'u2', personnelId: 'p1', ivMi: true })).toEqual({ hata: 'Kendi izin talebinizi onaylayamazsınız' })
    expect(onayYetkisi({ ...t, durum: 'BEKLIYOR_IV' }, { userId: 'u2', personnelId: 'p2', ivMi: false })).toMatchObject({ hata: expect.stringMatching(/izin.admin/) })
    expect(() => kararDogrula({ karar: 'RED', gerekce: '  ' })).toThrow('Red gerekçesi zorunlu')
    expect(kararDogrula({ karar: 'ONAY' })).toEqual({ karar: 'ONAY', gerekce: null })
    expect(iptalEdilebilirMi({ durum: 'ONAYLANDI', baslangic: '2026-10-26' }, '2026-10-26')).toBe(false) // başlamış
    expect(iptalEdilebilirMi({ durum: 'ONAYLANDI', baslangic: '2026-10-27' }, '2026-10-26')).toBe(true)
    expect(geriCekilebilirMi({ durum: 'ONAYLANDI' })).toBe(false)
  })
})

describe('mail — yöneticiye TÜR gitmez', () => {
  const t = { id: 'x', personelAd: 'Emre Aksoy', sicil: 'ILR-1', turAd: 'Evlilik izni', baslangic: '2026-11-02', bitis: '2026-11-04', gunSayisi: 3 }
  it('yönetici satırlarında tür yok, çalışan/İV satırlarında var', () => {
    expect(JSON.stringify(yoneticiSatirlari(t))).not.toMatch(/Evlilik|Tür/)
    expect(JSON.stringify(tamSatirlar(t))).toMatch(/Evlilik izni/)
  })
})

describe('PDKS izin kaynağı', () => {
  it('yalnız ONAYLANDI talebin pay>0 donmuş günleri; etiket her türde "İzinli", tür gitmez', async () => {
    let sorgu: unknown
    const kaynak = prismaIzinKaynagi({
      izinTalepGun: {
        findMany: async (q: unknown) => {
          sorgu = q
          return [{ personnelId: 'p1', talepId: 't1', pay: { toString: () => '0.5' }, yarim: 'SABAH' }]
        },
      },
    } as never)
    const m = await kaynak.izinDurumlari(['p1', 'p2'], '2026-10-26')
    expect(sorgu).toMatchObject({ where: { personnelId: { in: ['p1', 'p2'] }, pay: { gt: 0 }, talep: { durum: 'ONAYLANDI' } } })
    expect(m.get('p1')).toEqual({ izinli: true, yarim: 'SABAH', talepId: 't1', pay: 0.5, etiket: 'İzinli' })
    expect(m.has('p2')).toBe(false)
    expect(await prismaIzinKaynagi({ izinTalepGun: { findMany: async () => { throw new Error('çağrılmamalı') } } } as never).izinDurumlari([], '2026-10-26')).toEqual(new Map())
  })
})
