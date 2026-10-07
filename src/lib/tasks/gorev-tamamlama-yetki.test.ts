import { describe, it, expect } from 'vitest'
import {
  gorevAtananEpostalari,
  gorevAtananSicilleri,
  gorevBolumunuEslestir,
  gorevDurumDegistirebilir,
  type GorevBolumu,
  type GorevKaydi,
  type GorevYetkiGirdisi,
} from './gorev-tamamlama-yetki'

const BOLUMLER: GorevBolumu[] = [
  { id: 'd-iv', name: 'İnsan Varlıkları Müdürlüğü', mudurId: 'p-mudur-iv', mudurYardimcisiId: 'p-myrd-iv' },
  { id: 'd-sg', name: 'Sistem Geliştirme Müdürlüğü', mudurId: 'p-mudur-sg', mudurYardimcisiId: null },
  { id: 'd-yon', name: 'Yönetim', mudurId: 'p-mudur-yon', mudurYardimcisiId: null },
  { id: 'd-as1', name: 'Asansör Müdürlüğü', mudurId: 'p-as1', mudurYardimcisiId: null },
  { id: 'd-as2', name: 'Asansör Satış Pazarlama', mudurId: 'p-as2', mudurYardimcisiId: null },
]

// Prod deseni: çoklu atama {name,email,sicilNo}; e-postasız personel yalnız sicille taşınır.
const COKLU: GorevKaydi = {
  responsiblePersonEmail: 'ayse@ileri.com',
  responsiblePersons: JSON.stringify([
    { name: 'AYŞE YILMAZ', email: 'ayse@ileri.com', sicilNo: 'ILR-00101' },
    { name: 'MEHMET KAYA', email: null, sicilNo: 'ILR-00202' },
  ]),
  responsibleDepartment: 'İnsan Varlıkları',
}

function girdi(over: Partial<GorevYetkiGirdisi> = {}): GorevYetkiGirdisi {
  return {
    kullanici: { email: null, sicilNo: null, personnelId: null, rol: 'USER' },
    gorev: COKLU,
    bolumler: BOLUMLER,
    astEpostalari: [],
    ...over,
  }
}

describe('atanan çözümlemesi', () => {
  it('tek alan + çoklu diziden e-postaları tekilleştirir', () => {
    expect(gorevAtananEpostalari(COKLU)).toEqual(['ayse@ileri.com'])
  })

  it('e-postasız sorumlu yalnız sicille taşınır', () => {
    expect(gorevAtananSicilleri(COKLU)).toEqual(['ILR-00101', 'ILR-00202'])
  })

  it('bozuk JSON kapıyı açmaz, patlatmaz', () => {
    const bozuk: GorevKaydi = { responsiblePersonEmail: null, responsiblePersons: '{bozuk', responsibleDepartment: null }
    expect(gorevAtananEpostalari(bozuk)).toEqual([])
    expect(gorevAtananSicilleri(bozuk)).toEqual([])
    expect(gorevDurumDegistirebilir(girdi({ gorev: bozuk })).izinli).toBe(false)
  })
})

describe('atanan kişi durumu değiştirebilir', () => {
  it('e-postayla atanan (büyük/küçük harf farkı dahil)', () => {
    const k = gorevDurumDegistirebilir(
      girdi({ kullanici: { email: 'AYSE@ileri.com', sicilNo: null, personnelId: null, rol: 'USER' } }),
    )
    expect(k).toEqual({ izinli: true, sebep: 'ATANAN_EPOSTA' })
  })

  it('SİCİLLE atanan — e-postası olmayan personel (eski kapının kaçırdığı durum)', () => {
    const k = gorevDurumDegistirebilir(
      girdi({ kullanici: { email: null, sicilNo: 'ILR-00202', personnelId: null, rol: 'USER' } }),
    )
    expect(k).toEqual({ izinli: true, sebep: 'ATANAN_SICIL' })
  })

  it('çoklu atamanın ikinci kişisi de izinli (responsiblePersonEmail başkası)', () => {
    const gorev: GorevKaydi = {
      responsiblePersonEmail: 'ayse@ileri.com',
      responsiblePersons: JSON.stringify([
        { name: 'AYŞE', email: 'ayse@ileri.com', sicilNo: null },
        { name: 'VELİ', email: 'veli@ileri.com', sicilNo: null },
      ]),
      responsibleDepartment: null,
    }
    expect(
      gorevDurumDegistirebilir(
        girdi({ gorev, kullanici: { email: 'veli@ileri.com', sicilNo: null, personnelId: null, rol: 'USER' } }),
      ).sebep,
    ).toBe('ATANAN_EPOSTA')
  })
})

describe('bölüm koltuğu', () => {
  it('bölüm müdürü izinli (ad "İnsan Varlıkları" ↔ "… Müdürlüğü" ön ekiyle eşleşir)', () => {
    const k = gorevDurumDegistirebilir(
      girdi({ kullanici: { email: 'mudur@ileri.com', sicilNo: 'ILR-00001', personnelId: 'p-mudur-iv', rol: 'USER' } }),
    )
    expect(k).toEqual({ izinli: true, sebep: 'BOLUM_MUDURU' })
  })

  it('bölüm müdür yardımcısı izinli', () => {
    const k = gorevDurumDegistirebilir(
      girdi({ kullanici: { email: 'myrd@ileri.com', sicilNo: null, personnelId: 'p-myrd-iv', rol: 'USER' } }),
    )
    expect(k).toEqual({ izinli: true, sebep: 'BOLUM_MUDUR_YRD' })
  })

  it('BÖLÜMÜN SIRADAN ÇALIŞANI tamamlayamaz → 403', () => {
    const k = gorevDurumDegistirebilir(
      girdi({ kullanici: { email: 'calisan@ileri.com', sicilNo: 'ILR-00999', personnelId: 'p-calisan', rol: 'USER' } }),
    )
    expect(k).toEqual({ izinli: false, sebep: 'YOK' })
  })

  it('BAŞKA bölümün müdürü izinli değil', () => {
    const k = gorevDurumDegistirebilir(
      girdi({ kullanici: { email: 'sg@ileri.com', sicilNo: null, personnelId: 'p-mudur-sg', rol: 'USER' } }),
    )
    expect(k.izinli).toBe(false)
  })

  it('görev bölüme atanmamışsa koltuk yolu hiç açılmaz', () => {
    const gorev: GorevKaydi = { ...COKLU, responsibleDepartment: null }
    expect(
      gorevDurumDegistirebilir(
        girdi({ gorev, kullanici: { email: null, sicilNo: null, personnelId: 'p-mudur-iv', rol: 'USER' } }),
      ).izinli,
    ).toBe(false)
  })
})

describe('bölüm adı eşleştirme (Department ↔ DepartmentDefinition FK yok)', () => {
  it('birebir ad', () => {
    expect(gorevBolumunuEslestir('Yönetim', BOLUMLER)?.id).toBe('d-yon')
  })

  it('normalize ad (Türkçe harf / boşluk farkı)', () => {
    expect(gorevBolumunuEslestir('  yonetim ', BOLUMLER)?.id).toBe('d-yon')
  })

  it('ön ek: "Sistem Geliştirme" → "Sistem Geliştirme Müdürlüğü"', () => {
    expect(gorevBolumunuEslestir('Sistem Geliştirme', BOLUMLER)?.id).toBe('d-sg')
  })

  it('ÇOK ADAYLI ön ek eşleşmez (fail-closed): "Asansör" iki bölümün de ön eki', () => {
    expect(gorevBolumunuEslestir('Asansör', BOLUMLER)).toBeNull()
  })

  it('karşılığı olmayan ad eşleşmez: "Üretim Planlama", "Sistem Geliştirme Ekibi"', () => {
    expect(gorevBolumunuEslestir('Üretim Planlama', BOLUMLER)).toBeNull()
    expect(gorevBolumunuEslestir('Sistem Geliştirme Ekibi', BOLUMLER)).toBeNull()
  })

  it('boş/null ad eşleşmez', () => {
    expect(gorevBolumunuEslestir(null, BOLUMLER)).toBeNull()
    expect(gorevBolumunuEslestir('   ', BOLUMLER)).toBeNull()
  })
})

describe('LDAP amiri ve admin', () => {
  it('atananlardan biri astıysa amir izinli', () => {
    const k = gorevDurumDegistirebilir(
      girdi({
        kullanici: { email: 'amir@ileri.com', sicilNo: null, personnelId: null, rol: 'USER' },
        astEpostalari: ['AYSE@ileri.com', 'baskasi@ileri.com'],
      }),
    )
    expect(k).toEqual({ izinli: true, sebep: 'LDAP_AMIRI' })
  })

  it('astı olmayan yabancı izinli değil', () => {
    expect(
      gorevDurumDegistirebilir(
        girdi({
          kullanici: { email: 'yabanci@ileri.com', sicilNo: null, personnelId: null, rol: 'USER' },
          astEpostalari: ['baskasi@ileri.com'],
        }),
      ).izinli,
    ).toBe(false)
  })

  it('admin ve super admin her görevde izinli', () => {
    for (const rol of ['ADMIN', 'SUPER_ADMIN']) {
      expect(
        gorevDurumDegistirebilir(girdi({ kullanici: { email: 'it@ileri.com', sicilNo: null, personnelId: null, rol } })),
      ).toEqual({ izinli: true, sebep: 'ADMIN' })
    }
  })
})
