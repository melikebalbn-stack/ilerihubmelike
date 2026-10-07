import { describe, it, expect } from 'vitest'
import { sonrakiSiralama, tutanakKpi, tutanakSirala, tutanakSuz, type TutanakSatiri } from './tutanak-liste'

function satir(o: Partial<TutanakSatiri> & { id: string }): TutanakSatiri {
  return {
    tutanakNo: `TUT-2026-${o.id.padStart(3, '0')}`,
    tutanakTarihi: '2026-10-01',
    adSoyadSnapshot: 'AYŞE YILMAZ',
    sicilSnapshot: 'ILR-00101',
    bolumSnapshot: 'Talaşlı İmalat',
    gorevSnapshot: 'CNC Torna Operatörü',
    sebep: 'DISIPLIN',
    durum: 'SAHIT_BEKLIYOR',
    yoneticiAd: 'MEHMET KAYA',
    sahitSayisi: 2,
    onaylayanSahitSayisi: 1,
    acanAd: 'Müdür Bey',
    createdAt: '2026-10-01',
    ...o,
  }
}

const SATIRLAR: TutanakSatiri[] = [
  satir({ id: '1', durum: 'TASLAK', bolumSnapshot: 'Kaynakhane', sebep: 'DEVAMSIZLIK', adSoyadSnapshot: 'VELİ ÖZ' }),
  satir({ id: '2', durum: 'SAHIT_BEKLIYOR' }),
  satir({ id: '3', durum: 'YONETICI_BEKLIYOR', tutanakTarihi: '2026-09-15' }),
  satir({ id: '4', durum: 'IK_BEKLIYOR' }),
  satir({ id: '5', durum: 'TAMAMLANDI', sicilSnapshot: null, gorevSnapshot: null }),
  satir({ id: '6', durum: 'REDDEDILDI' }),
]

describe('süzgeçler', () => {
  it('sebep, durum ve bölüm süzgeçleri', () => {
    expect(tutanakSuz(SATIRLAR, { sebep: 'DEVAMSIZLIK' }).map((r) => r.id)).toEqual(['1'])
    expect(tutanakSuz(SATIRLAR, { durum: 'TAMAMLANDI' }).map((r) => r.id)).toEqual(['5'])
    expect(tutanakSuz(SATIRLAR, { bolum: 'Kaynakhane' }).map((r) => r.id)).toEqual(['1'])
  })

  it('"ACIK" süzgeci kapanmışları dışlar', () => {
    expect(tutanakSuz(SATIRLAR, { durum: 'ACIK' }).map((r) => r.id)).toEqual(['1', '2', '3', '4'])
  })

  it('arama tr-TR küçük harfle çalışır ve sebep/durum etiketlerinde de arar', () => {
    expect(tutanakSuz(SATIRLAR, { arama: 'VELİ' }).map((r) => r.id)).toEqual(['1'])
    expect(tutanakSuz(SATIRLAR, { arama: 'veli' }).map((r) => r.id)).toEqual(['1'])
    expect(tutanakSuz(SATIRLAR, { arama: 'Devamsızlık' }).map((r) => r.id)).toEqual(['1'])
    expect(tutanakSuz(SATIRLAR, { arama: 'ılr-00101' }).length).toBe(5)
  })

  it('HEPSI ve boş arama hiçbir şeyi süzmez', () => {
    expect(tutanakSuz(SATIRLAR, { arama: '', sebep: 'HEPSI', durum: 'HEPSI', bolum: 'HEPSI' })).toHaveLength(6)
  })
})

describe('sıralama', () => {
  it('üç durumlu başlık: yok → artan → azalan → yok', () => {
    expect(sonrakiSiralama(null, 'tutanakNo')).toEqual({ alan: 'tutanakNo', yon: 'asc' })
    expect(sonrakiSiralama({ alan: 'tutanakNo', yon: 'asc' }, 'tutanakNo')).toEqual({ alan: 'tutanakNo', yon: 'desc' })
    expect(sonrakiSiralama({ alan: 'tutanakNo', yon: 'desc' }, 'tutanakNo')).toBeNull()
    expect(sonrakiSiralama({ alan: 'tutanakNo', yon: 'desc' }, 'durum')).toEqual({ alan: 'durum', yon: 'asc' })
  })

  it('siralama null ise dizi AYNEN döner (varsayılan sıra bozulmaz)', () => {
    expect(tutanakSirala(SATIRLAR, null)).toBe(SATIRLAR)
  })

  it('tarih sıralaması gerçek tarih değerine göre', () => {
    expect(tutanakSirala(SATIRLAR, { alan: 'tutanakTarihi', yon: 'asc' })[0].id).toBe('3')
  })

  it('boş değerler yönden BAĞIMSIZ olarak sonda', () => {
    const asc = tutanakSirala(SATIRLAR, { alan: 'gorevSnapshot', yon: 'asc' })
    const desc = tutanakSirala(SATIRLAR, { alan: 'gorevSnapshot', yon: 'desc' })
    expect(asc[asc.length - 1].id).toBe('5')
    expect(desc[desc.length - 1].id).toBe('5')
  })
})

describe('KPI kartları', () => {
  it('her durumu sayar, açık = kapanmamışlar', () => {
    expect(tutanakKpi(SATIRLAR)).toEqual({
      toplam: 6,
      acik: 4,
      sahitBekleyen: 1,
      yoneticiBekleyen: 1,
      ivBekleyen: 1,
      tamamlanan: 1,
      reddedilen: 1,
    })
  })

  it('boş listede sıfırlar', () => {
    expect(tutanakKpi([]).toplam).toBe(0)
    expect(tutanakKpi([]).acik).toBe(0)
  })
})
