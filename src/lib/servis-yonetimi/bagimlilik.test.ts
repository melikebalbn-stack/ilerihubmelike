import { describe, expect, it, vi } from 'vitest'
import {
  BagliKayitHatasi,
  ORNEK_LIMITI,
  aracBagimliliklari,
  bagimlilikOzeti,
  bagimlilikToplami,
  bagliKayitMesaji,
  durakKodKullanimi,
  firmaBagimliliklari,
  guzergahBagimliliklari,
  guzergahKodKullanimi,
  kodDegistirilemezMesaji,
  onayAciklamasi,
  seferDilimiBagimliliklari,
  soforBagimliliklari,
  yerleskeBagimliliklari,
} from './bagimlilik'

// Sahte Db: model başına { count, findMany }. Her çağrının where'i kaydedilir.
type Model = { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }
function sahteDb(cevaplar: Record<string, { sayi?: number; satirlar?: unknown[] }> = {}) {
  const modeller = [
    'servisGuzergah', 'servisArac', 'servisSofor', 'servisGuzergahAracVarsayilan', 'servisGuzergahSoforVarsayilan',
    'servisPersonelAtama', 'servisPersonelAtamaDilim', 'servisGuzergahDurakSaat', 'servisSorumlusu', 'servisSikayet',
  ]
  const db: Record<string, Model> = {}
  for (const m of modeller) {
    db[m] = {
      count: vi.fn(async () => cevaplar[m]?.sayi ?? 0),
      findMany: vi.fn(async () => cevaplar[m]?.satirlar ?? []),
    }
  }
  return db as unknown as Parameters<typeof yerleskeBagimliliklari>[0] & Record<string, Model>
}

describe('pasifleştirme bağımlılıkları — yalnız AKTİF kayıtlar', () => {
  it('yerleşke → aktif güzergâhlar (örnek: kod — ad)', async () => {
    const db = sahteDb({ servisGuzergah: { sayi: 3, satirlar: [{ kod: 'DARICA', ad: 'Darıca Hattı' }] } })
    const g = await yerleskeBagimliliklari(db, 'y1')
    expect(g).toEqual([{ tur: 'GUZERGAH', etiket: 'Aktif güzergâh', sayi: 3, ornekler: ['DARICA — Darıca Hattı'] }])
    expect((db as unknown as Record<string, Model>).servisGuzergah.count).toHaveBeenCalledWith({ where: { yerleskeId: 'y1', aktif: true } })
  })

  it('bağlı kayıt yoksa boş liste (grup üretilmez)', async () => {
    expect(await yerleskeBagimliliklari(sahteDb(), 'y1')).toEqual([])
    expect(await firmaBagimliliklari(sahteDb(), 'f1')).toEqual([])
    expect(await aracBagimliliklari(sahteDb(), 'a1')).toEqual([])
    expect(await soforBagimliliklari(sahteDb(), 's1')).toEqual([])
    expect(await guzergahBagimliliklari(sahteDb(), 'g1')).toEqual([])
    expect(await seferDilimiBagimliliklari(sahteDb(), 'd1')).toEqual([])
  })

  it('firma → aktif araç (plaka örnekli) + aktif şoför', async () => {
    const db = sahteDb({
      servisArac: { sayi: 2, satirlar: [{ plaka: '41P0145' }, { plaka: '41P0327' }] },
      servisSofor: { sayi: 4 },
    })
    const g = await firmaBagimliliklari(db, 'f1')
    expect(g.map((x) => [x.tur, x.sayi, x.ornekler])).toEqual([
      ['ARAC', 2, ['41P0145', '41P0327']],
      ['SOFOR', 4, []],
    ])
  })

  it('araç → aktif varsayılan araç atamaları (güzergâh / dilim)', async () => {
    const db = sahteDb({
      servisGuzergahAracVarsayilan: { sayi: 1, satirlar: [{ guzergah: { kod: 'DARICA' }, dilim: { kod: 'SABAH_GIDIS' } }] },
    })
    expect(await aracBagimliliklari(db, 'a1')).toEqual([
      { tur: 'ARAC_VARSAYILAN', etiket: 'Aktif varsayılan araç ataması', sayi: 1, ornekler: ['DARICA / SABAH_GIDIS'] },
    ])
  })

  it('şoför → aktif varsayılan şoför atamaları', async () => {
    const db = sahteDb({
      servisGuzergahSoforVarsayilan: { sayi: 2, satirlar: [{ guzergah: { kod: 'DARICA' }, dilim: { kod: 'AKSAM_DONUS' } }] },
    })
    const g = await soforBagimliliklari(db, 's1')
    expect(g[0]).toMatchObject({ tur: 'SOFOR_VARSAYILAN', sayi: 2, ornekler: ['DARICA / AKSAM_DONUS'] })
  })

  it('güzergâh → aktif personel atamaları + araç ve şoför atamaları', async () => {
    const db = sahteDb({
      servisPersonelAtama: { sayi: 12 },
      servisGuzergahAracVarsayilan: { sayi: 2, satirlar: [{ arac: { plaka: '41P0145' }, dilim: { kod: 'SABAH_GIDIS' } }] },
      servisGuzergahSoforVarsayilan: { sayi: 1 },
    })
    const g = await guzergahBagimliliklari(db, 'g1')
    expect(g.map((x) => [x.tur, x.sayi])).toEqual([['PERSONEL_ATAMA', 12], ['ARAC_VARSAYILAN', 2], ['SOFOR_VARSAYILAN', 1]])
  })

  it('sefer dilimi → araç/şoför atamaları, AKTİF personel atamasına bağlı dilim satırları, aktif durak saatleri', async () => {
    const db = sahteDb({
      servisGuzergahAracVarsayilan: { sayi: 1, satirlar: [{ guzergah: { kod: 'DARICA' }, arac: { plaka: '41P0145' } }] },
      servisGuzergahSoforVarsayilan: { sayi: 1 },
      servisPersonelAtamaDilim: { sayi: 30 },
      servisGuzergahDurakSaat: { sayi: 138 },
    })
    const g = await seferDilimiBagimliliklari(db, 'd1')
    expect(g.map((x) => [x.tur, x.sayi])).toEqual([
      ['ARAC_VARSAYILAN', 1], ['SOFOR_VARSAYILAN', 1], ['PERSONEL_ATAMA', 30], ['DURAK_SAAT', 138],
    ])
    const m = db as unknown as Record<string, Model>
    expect(m.servisPersonelAtamaDilim.count).toHaveBeenCalledWith({ where: { dilimId: 'd1', atama: { aktif: true } } })
    expect(m.servisGuzergahDurakSaat.count).toHaveBeenCalledWith({ where: { dilimId: 'd1', aktif: true } })
  })

  it('örnekler ORNEK_LIMITI ile sınırlıdır ve count tam sayıyı verir', async () => {
    const satirlar = Array.from({ length: 9 }, (_, i) => ({ plaka: `34 X ${i}` }))
    const db = sahteDb({ servisArac: { sayi: 9, satirlar } })
    const [arac] = await firmaBagimliliklari(db, 'f1')
    expect(arac.sayi).toBe(9)
    expect(arac.ornekler).toHaveLength(ORNEK_LIMITI)
    expect((db as unknown as Record<string, Model>).servisArac.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: ORNEK_LIMITI }),
    )
  })

  it('🔴 KVKK: kişi içeren gruplarda (personel atama, şoför) ÖRNEK satır taşınmaz — yalnız sayı', async () => {
    const db = sahteDb({
      servisPersonelAtama: { sayi: 5 },
      servisGuzergahSoforVarsayilan: { sayi: 1 },
      servisSofor: { sayi: 2 },
    })
    const gruplar = [
      ...(await guzergahBagimliliklari(db, 'g1')),
      ...(await firmaBagimliliklari(db, 'f1')),
    ].filter((g) => ['PERSONEL_ATAMA', 'SOFOR_VARSAYILAN', 'SOFOR'].includes(g.tur))
    expect(gruplar.length).toBeGreaterThanOrEqual(3)
    for (const g of gruplar) expect(g.ornekler).toEqual([])
    // ve bu modellerde findMany (satır okuma) HİÇ çağrılmaz
    const m = db as unknown as Record<string, Model>
    expect(m.servisPersonelAtama.findMany).not.toHaveBeenCalled()
    expect(m.servisSofor.findMany).not.toHaveBeenCalled()
    expect(m.servisGuzergahSoforVarsayilan.findMany).not.toHaveBeenCalled()
  })
})

describe('kod kullanımı — aktif VE pasif (geçmiş de sayılır)', () => {
  it('güzergâh: aktif filtresi YOK; personel/araç/şoför/sorumlu/şikâyet', async () => {
    const db = sahteDb({
      servisPersonelAtama: { sayi: 3 }, servisGuzergahAracVarsayilan: { sayi: 1 }, servisGuzergahSoforVarsayilan: { sayi: 1 },
      servisSorumlusu: { sayi: 2 }, servisSikayet: { sayi: 4 },
    })
    const k = await guzergahKodKullanimi(db, 'g1')
    expect(k.map((x) => [x.tur, x.sayi])).toEqual([
      ['PERSONEL_ATAMA', 3], ['ARAC_VARSAYILAN', 1], ['SOFOR_VARSAYILAN', 1], ['SORUMLU', 2], ['SIKAYET', 4],
    ])
    const m = db as unknown as Record<string, Model>
    expect(m.servisPersonelAtama.count).toHaveBeenCalledWith({ where: { guzergahId: 'g1' } }) // aktif YOK
    expect(m.servisSikayet.count).toHaveBeenCalledWith({ where: { guzergahId: 'g1' } })
  })

  it('durak: personel ataması + şikâyet (durakId)', async () => {
    const db = sahteDb({ servisPersonelAtama: { sayi: 2 }, servisSikayet: { sayi: 1 } })
    const k = await durakKodKullanimi(db, 'd1')
    expect(k.map((x) => [x.tur, x.sayi])).toEqual([['PERSONEL_ATAMA', 2], ['SIKAYET', 1]])
    const m = db as unknown as Record<string, Model>
    expect(m.servisPersonelAtama.count).toHaveBeenCalledWith({ where: { durakId: 'd1' } })
  })

  it('kullanım yoksa boş liste', async () => {
    expect(await guzergahKodKullanimi(sahteDb(), 'g1')).toEqual([])
    expect(await durakKodKullanimi(sahteDb(), 'd1')).toEqual([])
  })
})

describe('mesajlar', () => {
  const g = [
    { tur: 'ARAC', etiket: 'Aktif araç', sayi: 2, ornekler: [] },
    { tur: 'SOFOR', etiket: 'Aktif şoför', sayi: 1, ornekler: [] },
  ]

  it('toplam, özet (Türkçe küçük harf: İ/I doğru) ve mesajlar', () => {
    expect(bagimlilikToplami(g)).toBe(3)
    expect(bagimlilikOzeti(g)).toBe('2 aktif araç, 1 aktif şoför')
    expect(bagimlilikOzeti([{ tur: 'X', etiket: 'Aktif İşlem', sayi: 1, ornekler: [] }])).toBe('1 aktif işlem')
    expect(bagliKayitMesaji('Firma', g)).toBe(
      'Firma pasifleştirilemez: bağlı aktif kayıtlar var (2 aktif araç, 1 aktif şoför). Bağlı kayıtlar otomatik kapatılmaz; onaylarsanız yalnız bu kayıt pasifleştirilir.',
    )
    expect(onayAciklamasi(g)).toBe(
      'Bağlı aktif kayıtlar varken kullanıcı onayıyla pasifleştirildi: 2 aktif araç, 1 aktif şoför. Bağlı kayıtlar otomatik kapatılmadı.',
    )
  })

  it('kod değiştirilemez mesajı (güzergâhın / durağın)', () => {
    const k = [{ tur: 'SIKAYET', etiket: 'şikâyet', sayi: 1, ornekler: [] }]
    expect(kodDegistirilemezMesaji('güzergâhın', k)).toBe('Bu güzergâhın kodu değiştirilemez: 1 şikâyet bu kodla ilişkili. Ad serbestçe değiştirilebilir.')
    expect(kodDegistirilemezMesaji('durağın', k)).toBe('Bu durağın kodu değiştirilemez: 1 şikâyet bu kodla ilişkili. Ad serbestçe değiştirilebilir.')
  })

  it('BagliKayitHatasi bağımlılıkları taşır', () => {
    const e = new BagliKayitHatasi('m', g)
    expect(e).toBeInstanceOf(Error)
    expect(e.bagimliliklar).toBe(g)
  })
})
