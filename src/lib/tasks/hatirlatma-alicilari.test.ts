import { describe, it, expect } from 'vitest'
import {
  bolumBilgisiGerekirMi,
  bolumSorumluSatiri,
  gorevBolumleri,
  kurumsalAlicilar,
  gorevHatirlatmaAlicilari,
  gorevHatirlatmaAlicilariAdli,
  hatirlatmaGonderilebilirMi,
  sorumluSatiri,
  type HatirlatmaGorevi,
} from './hatirlatma-alicilari'

// 08.10.2026 olayındaki gerçek görev: sorumlu GÖKÇE EKŞİOĞLU, adresi tek alanda
// ve dizide AYNI; mail ise kalibrasyon listesindeki 3 kişiye (her biri iki kez)
// gidiyordu.
const OLAY_GOREVI: HatirlatmaGorevi = {
  responsiblePerson: 'GÖKÇE EKŞİOĞLU',
  responsiblePersonEmail: 'gokcedemirkaya@hotmail.com',
  responsiblePersons: JSON.stringify([
    { name: 'GÖKÇE EKŞİOĞLU', email: 'gokcedemirkaya@hotmail.com', sicilNo: 'ILR-00825' },
  ]),
}

describe('1) tek sorumlu', () => {
  it('yalnız tek-alan sorumlusu varsa o adres döner', () => {
    expect(
      gorevHatirlatmaAlicilari({ responsiblePerson: 'AYŞE', responsiblePersonEmail: 'ayse@ileri.com' }),
    ).toEqual(['ayse@ileri.com'])
  })

  it('yalnız dizide sorumlu varsa (tek alan boş) o adres döner', () => {
    expect(
      gorevHatirlatmaAlicilari({
        responsiblePersonEmail: null,
        responsiblePersons: JSON.stringify([{ name: 'VELİ', email: 'veli@ileri.com' }]),
      }),
    ).toEqual(['veli@ileri.com'])
  })
})

describe('2) çoklu sorumlu', () => {
  it('tek alan + dizideki herkes, sırayla', () => {
    expect(
      gorevHatirlatmaAlicilari({
        responsiblePerson: 'AYŞE',
        responsiblePersonEmail: 'ayse@ileri.com',
        responsiblePersons: JSON.stringify([
          { name: 'AYŞE', email: 'ayse@ileri.com' },
          { name: 'VELİ', email: 'veli@ileri.com' },
          { name: 'ZEYNEP', email: 'zeynep@ileri.com' },
        ]),
      }),
    ).toEqual(['ayse@ileri.com', 'veli@ileri.com', 'zeynep@ileri.com'])
  })

  it('e-postası olmayan sorumlu (yalnız sicil) alıcı listesine girmez', () => {
    expect(
      gorevHatirlatmaAlicilari({
        responsiblePersonEmail: 'ayse@ileri.com',
        responsiblePersons: JSON.stringify([
          { name: 'AYŞE', email: 'ayse@ileri.com', sicilNo: 'ILR-1' },
          { name: 'MEHMET', email: null, sicilNo: 'ILR-2' },
        ]),
      }),
    ).toEqual(['ayse@ileri.com'])
  })
})

describe('3) sorumlu yok → mail GÖNDERİLMEZ', () => {
  it('her iki kaynak boşsa liste boş', () => {
    expect(gorevHatirlatmaAlicilari({})).toEqual([])
    expect(gorevHatirlatmaAlicilari({ responsiblePersonEmail: null, responsiblePersons: null })).toEqual([])
    expect(gorevHatirlatmaAlicilari({ responsiblePersonEmail: '   ', responsiblePersons: '[]' })).toEqual([])
  })

  it('bozuk JSON patlatmaz, boş liste döner', () => {
    expect(gorevHatirlatmaAlicilari({ responsiblePersons: '{bozuk' })).toEqual([])
    expect(gorevHatirlatmaAlicilari({ responsiblePersons: '"metin"' })).toEqual([])
  })

  it('geçersiz biçimli adres alınmaz', () => {
    expect(gorevHatirlatmaAlicilari({ responsiblePersonEmail: 'gecersiz' })).toEqual([])
    expect(gorevHatirlatmaAlicilari({ responsiblePersonEmail: 'a@b' })).toEqual([])
    expect(gorevHatirlatmaAlicilari({ responsiblePersonEmail: 'a b@c.com' })).toEqual([])
  })

  it('gönderim kapısı: alıcı yoksa false', () => {
    expect(hatirlatmaGonderilebilirMi({})).toBe(false)
    expect(hatirlatmaGonderilebilirMi(OLAY_GOREVI)).toBe(true)
  })
})

describe('4) aynı kişi iki kaynakta → TEK adres', () => {
  it('olay görevi: aynı adres tek alanda ve dizide → bir kez', () => {
    expect(gorevHatirlatmaAlicilari(OLAY_GOREVI)).toEqual(['gokcedemirkaya@hotmail.com'])
  })

  it('büyük/küçük harf ve boşluk farkı tekilleştirmeyi bozmaz', () => {
    expect(
      gorevHatirlatmaAlicilari({
        responsiblePersonEmail: '  AYSE@Ileri.COM ',
        responsiblePersons: JSON.stringify([
          { name: 'AYŞE', email: 'ayse@ileri.com' },
          { name: 'Ayse', email: 'AYSE@ILERI.COM' },
        ]),
      }),
    ).toEqual(['ayse@ileri.com'])
  })

  it('dizide mükerrer satır varsa da tek adres', () => {
    expect(
      gorevHatirlatmaAlicilari({
        responsiblePersons: JSON.stringify([
          { name: 'VELİ', email: 'veli@ileri.com' },
          { name: 'VELİ', email: 'veli@ileri.com' },
          { name: 'VELİ', email: 'veli@ileri.com' },
        ]),
      }),
    ).toEqual(['veli@ileri.com'])
  })
})

describe('5) admin / ilgisiz kişiler listede DEĞİL', () => {
  // Olaydaki üç adres: kalibrasyon bildirim listesinden geliyordu. Bu modülün
  // böyle bir girdisi YOK — görevde ne yazarsa yazsın sızamazlar.
  const OLAYDAKI_YANLIS_ALICILAR = [
    'melih.dilben@ilerigroup.com',
    'melike.balaban@ilerigroup.com',
    'kerem.akbay@ilerigroup.com',
  ]

  it('görev kaydındaki başka alanlar (oluşturan, notificationEmails, bölüm) alıcı üretmez', () => {
    const gorev = {
      ...OLAY_GOREVI,
      // Bu alanlar bilinçli olarak YOKSAYILIR (CC yok kuralı).
      createdBy: 'melih.dilben@ilerigroup.com',
      notificationEmails: OLAYDAKI_YANLIS_ALICILAR,
      responsibleDepartment: 'İnsan Varlıkları',
    } as HatirlatmaGorevi
    const alicilar = gorevHatirlatmaAlicilari(gorev)
    expect(alicilar).toEqual(['gokcedemirkaya@hotmail.com'])
    for (const yanlis of OLAYDAKI_YANLIS_ALICILAR) expect(alicilar).not.toContain(yanlis)
  })

  it('admin kişi YALNIZ gerçekten sorumluysa listede olur', () => {
    expect(
      gorevHatirlatmaAlicilari({
        responsiblePerson: 'FAZIL MELİH DİLBEN',
        responsiblePersonEmail: 'melih.dilben@ilerigroup.com',
      }),
    ).toEqual(['melih.dilben@ilerigroup.com'])
  })
})

describe('gövdedeki "Sorumlu:" satırı TO ile birebir', () => {
  it('adlı liste ile e-posta listesi aynı küme ve aynı sıra', () => {
    const gorev: HatirlatmaGorevi = {
      responsiblePerson: 'AYŞE',
      responsiblePersonEmail: 'ayse@ileri.com',
      responsiblePersons: JSON.stringify([
        { name: 'AYŞE', email: 'ayse@ileri.com' },
        { name: 'VELİ', email: 'veli@ileri.com' },
      ]),
    }
    expect(gorevHatirlatmaAlicilariAdli(gorev).map((a) => a.email)).toEqual(gorevHatirlatmaAlicilari(gorev))
    expect(sorumluSatiri(gorev)).toBe('AYŞE <ayse@ileri.com>, VELİ <veli@ileri.com>')
  })

  it('adı bilinmeyen alıcıda yalnız e-posta yazılır', () => {
    expect(sorumluSatiri({ responsiblePersonEmail: 'kimsiz@ileri.com' })).toBe('kimsiz@ileri.com')
  })

  it('sorumlu yoksa satır boş (gövdede hiç çizilmez)', () => {
    expect(sorumluSatiri({})).toBe('')
  })
})

describe('bölüme atanmış görevler (madde 3)', () => {
  it('tek bölüm: çoklu alan boşsa tek alandan okunur', () => {
    const g = { responsibleDepartment: 'İnsan Varlıkları', responsibleDepartments: [] }
    expect(gorevBolumleri(g)).toEqual(['İnsan Varlıkları'])
    expect(bolumBilgisiGerekirMi(g)).toBe(true)
    expect(bolumSorumluSatiri(g)).toBe('İnsan Varlıkları (bölüme atanmış görev)')
  })

  it('çoklu bölüm: dizi + tek alan birleşir, mükerrer tekilleşir', () => {
    const g = {
      responsibleDepartment: 'İnsan Varlıkları',
      responsibleDepartments: ['İnsan Varlıkları', 'Kalite', 'insan varlıkları'],
    }
    expect(gorevBolumleri(g)).toEqual(['İnsan Varlıkları', 'Kalite'])
    expect(bolumSorumluSatiri(g)).toBe('İnsan Varlıkları, Kalite (bölüme atanmış görev)')
  })

  it('bölüm bulunamadı / bölüm yok: bilgi maili gerekmez', () => {
    expect(bolumBilgisiGerekirMi({ responsibleDepartment: null, responsibleDepartments: [] })).toBe(false)
    expect(bolumBilgisiGerekirMi({ responsibleDepartment: '   ', responsibleDepartments: [''] })).toBe(false)
    expect(gorevBolumleri({ responsibleDepartment: null })).toEqual([])
    expect(bolumSorumluSatiri({ responsibleDepartments: [] })).toBe('')
  })

  it('KİŞİ sorumlusu varsa bölüm maili GÖNDERİLMEZ (kişi kuralı önce)', () => {
    expect(
      bolumBilgisiGerekirMi({
        responsiblePersonEmail: 'ayse@ileri.com',
        responsibleDepartment: 'İnsan Varlıkları',
        responsibleDepartments: ['Kalite'],
      }),
    ).toBe(false)
  })

  it('bölüm alıcıları YALNIZ kurumsal adres; tekil ve küçük harf', () => {
    expect(
      kurumsalAlicilar([
        { email: 'Elif.Karadeniz@ilerigroup.com', ad: 'ELİF KARADENİZ' },
        { email: 'elif.karadeniz@ilerigroup.com', ad: 'ELİF KARADENİZ' },
        { email: 'kisisel@hotmail.com', ad: 'GÖKÇE' },
        { email: 'baska@gmail.com', ad: 'X' },
        { email: null, ad: 'E-postasız' },
        { email: 'gecersiz', ad: 'Bozuk' },
        { email: 'nurgul.tastan@ilerigroup.com', ad: null },
      ]),
    ).toEqual([
      { email: 'elif.karadeniz@ilerigroup.com', name: 'ELİF KARADENİZ' },
      { email: 'nurgul.tastan@ilerigroup.com', name: 'nurgul.tastan@ilerigroup.com' },
    ])
  })

  it('kurumsal adresli kimse yoksa boş liste (görev özete düşer)', () => {
    expect(kurumsalAlicilar([{ email: 'a@hotmail.com' }, { email: null }])).toEqual([])
  })
})
