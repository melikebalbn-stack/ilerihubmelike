import { describe, it, expect } from 'vitest'
import {
  tutanakGorebilir,
  tutanakIvMi,
  tutanakListeWhere,
  tutanakOnaylayabilir,
  type TutanakKimlik,
} from './tutanak-yetki'
import type { TutanakDurum, TutanakSahitDurum } from '@/generated/prisma'

function tutanak(over: Partial<TutanakKimlik> = {}): TutanakKimlik {
  return {
    personnelId: 'p-hakkinda',
    acanUserId: 'u-acan',
    yoneticiId: 'p-yonetici',
    bilgilendirilenSonYoneticiId: 'p-sonyonetici',
    durum: 'SAHIT_BEKLIYOR' as TutanakDurum,
    sahitler: [
      { personnelId: 'p-s1', durum: 'BEKLIYOR' as TutanakSahitDurum },
      { personnelId: 'p-s2', durum: 'ONAYLADI' as TutanakSahitDurum },
    ],
    ...over,
  }
}

const kisi = (o: Partial<{ userId: string; personnelId: string | null; iv: boolean; platformBypass: boolean }> = {}) => ({
  userId: 'u-x',
  personnelId: null as string | null,
  iv: false,
  platformBypass: false,
  ...o,
})

describe('İV kümesi', () => {
  it('rol ya da departman ile belirlenir', () => {
    expect(tutanakIvMi('HR_MANAGER', 'Talaşlı İmalat')).toBe(true)
    expect(tutanakIvMi('SUPER_ADMIN', null)).toBe(true)
    expect(tutanakIvMi('USER', 'İnsan Varlıkları')).toBe(true)
    expect(tutanakIvMi('USER', 'Talaşlı İmalat')).toBe(false)
  })
})

describe('görme kapısı', () => {
  it('oluşturan, şahit, yönetici, son yönetici ve İV görür', () => {
    expect(tutanakGorebilir(tutanak(), kisi({ userId: 'u-acan' }))).toEqual({ izinli: true, sebep: 'ACAN' })
    expect(tutanakGorebilir(tutanak(), kisi({ personnelId: 'p-s1' })).sebep).toBe('SAHIT')
    expect(tutanakGorebilir(tutanak(), kisi({ personnelId: 'p-yonetici' })).sebep).toBe('YONETICI')
    expect(tutanakGorebilir(tutanak(), kisi({ personnelId: 'p-sonyonetici' })).sebep).toBe('SON_YONETICI')
    expect(tutanakGorebilir(tutanak(), kisi({ iv: true })).sebep).toBe('IV')
    expect(tutanakGorebilir(tutanak(), kisi({ platformBypass: true })).sebep).toBe('PLATFORM')
  })

  it('HAKKINDA TUTANAK TUTULAN PERSONEL GÖREMEZ', () => {
    expect(tutanakGorebilir(tutanak(), kisi({ personnelId: 'p-hakkinda' }))).toEqual({
      izinli: false,
      sebep: 'HAKKINDA_OLAN',
    })
  })

  it('hakkında olan kişi şahit/yönetici/İV/platform olsa bile göremez (kural en üstte)', () => {
    const t = tutanak({ sahitler: [{ personnelId: 'p-hakkinda', durum: 'BEKLIYOR' }], yoneticiId: 'p-hakkinda' })
    expect(tutanakGorebilir(t, kisi({ personnelId: 'p-hakkinda', iv: true, platformBypass: true })).izinli).toBe(false)
    // Oluşturan da aynı kişiyse yine göremez
    expect(
      tutanakGorebilir(tutanak({ acanUserId: 'u-ben' }), kisi({ userId: 'u-ben', personnelId: 'p-hakkinda' })).izinli,
    ).toBe(false)
  })

  it('ilgisiz kullanıcı göremez', () => {
    expect(tutanakGorebilir(tutanak(), kisi({ personnelId: 'p-yabanci' }))).toEqual({ izinli: false, sebep: 'YOK' })
  })
})

describe('onay kapısı — yalnız adım sahibi', () => {
  it('TASLAK yalnız oluşturan tarafından gönderilir', () => {
    const t = tutanak({ durum: 'TASLAK' })
    expect(tutanakOnaylayabilir(t, kisi({ userId: 'u-acan' })).izinli).toBe(true)
    expect(tutanakOnaylayabilir(t, kisi({ userId: 'u-baska', iv: true })).izinli).toBe(false)
  })

  it('şahit adımında YALNIZ bekleyen şahit onaylar; karar vermiş şahit tekrar onaylayamaz', () => {
    const t = tutanak()
    expect(tutanakOnaylayabilir(t, kisi({ personnelId: 'p-s1' })).izinli).toBe(true)
    expect(tutanakOnaylayabilir(t, kisi({ personnelId: 'p-s2' })).izinli).toBe(false)
  })

  it('şahit adımında yönetici ve İV onaylayamaz (sıra atlanmaz)', () => {
    const t = tutanak()
    expect(tutanakOnaylayabilir(t, kisi({ personnelId: 'p-yonetici' })).izinli).toBe(false)
    expect(tutanakOnaylayabilir(t, kisi({ iv: true })).izinli).toBe(false)
  })

  it('yönetici adımında yalnız seçilen yönetici; son yönetici onaylayamaz', () => {
    const t = tutanak({ durum: 'YONETICI_BEKLIYOR' })
    expect(tutanakOnaylayabilir(t, kisi({ personnelId: 'p-yonetici' })).izinli).toBe(true)
    expect(tutanakOnaylayabilir(t, kisi({ personnelId: 'p-sonyonetici' })).izinli).toBe(false)
    expect(tutanakOnaylayabilir(t, kisi({ personnelId: 'p-s1' })).izinli).toBe(false)
  })

  it('İV adımını yalnız İV kapatır', () => {
    const t = tutanak({ durum: 'IK_BEKLIYOR' })
    expect(tutanakOnaylayabilir(t, kisi({ iv: true })).izinli).toBe(true)
    expect(tutanakOnaylayabilir(t, kisi({ personnelId: 'p-yonetici' })).izinli).toBe(false)
  })

  it('PLATFORM YÖNETİCİSİ BYPASS YOK — hiçbir adımı onaylayamaz (§3)', () => {
    for (const durum of ['TASLAK', 'SAHIT_BEKLIYOR', 'YONETICI_BEKLIYOR', 'IK_BEKLIYOR'] as TutanakDurum[]) {
      const k = { userId: 'u-platform', personnelId: 'p-platform', iv: false }
      expect(tutanakOnaylayabilir(tutanak({ durum }), k).izinli).toBe(false)
    }
  })

  it('kapanmış tutanakta kimse işlem yapamaz', () => {
    for (const durum of ['TAMAMLANDI', 'REDDEDILDI'] as TutanakDurum[]) {
      expect(tutanakOnaylayabilir(tutanak({ durum }), kisi({ iv: true })).izinli).toBe(false)
      expect(tutanakOnaylayabilir(tutanak({ durum }), kisi({ userId: 'u-acan' })).izinli).toBe(false)
    }
  })
})

describe('liste kapsamı (where)', () => {
  it('İV tümünü görür ama KENDİ hakkındaki tutanağı görmez', () => {
    const w = tutanakListeWhere({ userId: 'u-iv', personnelId: 'p-iv', iv: true, platformBypass: false })
    expect(w).toEqual({ personnelId: { not: 'p-iv' } })
  })

  it('Personnel bağı olmayan İV kullanıcısında süzgeç boş kalır', () => {
    expect(tutanakListeWhere({ userId: 'u-iv', personnelId: null, iv: true, platformBypass: false })).toEqual({})
  })

  it('koltuk sahibi yalnız ilgili olduğu tutanakları görür, kendi hakkındakini görmez', () => {
    const w = tutanakListeWhere({ userId: 'u-m', personnelId: 'p-m', iv: false, platformBypass: false })
    expect(w).toEqual({
      AND: [
        {
          OR: [
            { acanUserId: 'u-m' },
            { sahitler: { some: { personnelId: 'p-m' } } },
            { yoneticiId: 'p-m' },
            { bilgilendirilenSonYoneticiId: 'p-m' },
          ],
        },
        { personnelId: { not: 'p-m' } },
      ],
    })
  })

  it('Personnel bağı yoksa yalnız kendi açtıkları', () => {
    const w = tutanakListeWhere({ userId: 'u-x', personnelId: null, iv: false, platformBypass: false })
    expect(w).toEqual({ AND: [{ OR: [{ acanUserId: 'u-x' }] }, {}] })
  })
})
