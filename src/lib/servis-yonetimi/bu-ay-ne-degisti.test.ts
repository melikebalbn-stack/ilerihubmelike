import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  islemGecmisiFindMany: vi.fn(),
  personelAtamaFindMany: vi.fn(),
  personelAtamaFindFirst: vi.fn(),
  aracVarsayilanFindMany: vi.fn(),
  aracVarsayilanFindFirst: vi.fn(),
  soforVarsayilanFindMany: vi.fn(),
  soforVarsayilanFindFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servisIslemGecmisi: { findMany: mocks.islemGecmisiFindMany },
    servisPersonelAtama: { findMany: mocks.personelAtamaFindMany, findFirst: mocks.personelAtamaFindFirst },
    servisGuzergahAracVarsayilan: { findMany: mocks.aracVarsayilanFindMany, findFirst: mocks.aracVarsayilanFindFirst },
    servisGuzergahSoforVarsayilan: { findMany: mocks.soforVarsayilanFindMany, findFirst: mocks.soforVarsayilanFindFirst },
  },
}))

import {
  ayAraligiHesapla,
  personelAtamaDegisikligiSiniflandir,
  kaynakDegistiMi,
  buAyNeDegistiGetir,
} from './bu-ay-ne-degisti'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.islemGecmisiFindMany.mockResolvedValue([])
})

describe('ayAraligiHesapla', () => {
  it('verilen yıl+ay için ayın ilk ve son anını (UTC) döner', () => {
    const { baslangic, bitis } = ayAraligiHesapla(2026, 3)
    expect(baslangic.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(bitis.toISOString()).toBe('2026-03-31T23:59:59.999Z')
  })

  it('şubat (artık yıl DEĞİL) 28 gün çeker', () => {
    const { bitis } = ayAraligiHesapla(2026, 2)
    expect(bitis.toISOString()).toBe('2026-02-28T23:59:59.999Z')
  })

  it('şubat (artık yıl) 29 gün çeker', () => {
    const { bitis } = ayAraligiHesapla(2028, 2)
    expect(bitis.toISOString()).toBe('2028-02-29T23:59:59.999Z')
  })

  it('parametre verilmezse cari ay/yılı kullanır', () => {
    const simdi = new Date()
    const { baslangic } = ayAraligiHesapla()
    expect(baslangic.getUTCFullYear()).toBe(simdi.getUTCFullYear())
    expect(baslangic.getUTCMonth()).toBe(simdi.getUTCMonth())
    expect(baslangic.getUTCDate()).toBe(1)
  })

  it('aralık ayı bir sonraki yıla taşmaz (yıl sonu sınırı)', () => {
    const { bitis } = ayAraligiHesapla(2026, 12)
    expect(bitis.toISOString()).toBe('2026-12-31T23:59:59.999Z')
  })
})

describe('personelAtamaDegisikligiSiniflandir', () => {
  const temel = { guzergahId: 'g1', durakId: 'd1', dilimIdleri: ['s1'] }

  it('önceki atama yoksa YENI döner', () => {
    expect(personelAtamaDegisikligiSiniflandir(temel, null)).toBe('YENI')
  })

  it('güzergah farklıysa SERVIS_DEGISTI döner (durak/dilim de farklı olsa bile öncelik güzergahta)', () => {
    expect(
      personelAtamaDegisikligiSiniflandir(temel, { guzergahId: 'g2', durakId: 'd9', dilimIdleri: ['s9'] }),
    ).toBe('SERVIS_DEGISTI')
  })

  it('güzergah aynı, durak farklıysa DURAK_DEGISTI döner', () => {
    expect(personelAtamaDegisikligiSiniflandir(temel, { guzergahId: 'g1', durakId: 'd2', dilimIdleri: ['s1'] })).toBe(
      'DURAK_DEGISTI',
    )
  })

  it('güzergah+durak aynı, dilim seti farklıysa VARDIYA_DEGISTI döner', () => {
    expect(personelAtamaDegisikligiSiniflandir(temel, { guzergahId: 'g1', durakId: 'd1', dilimIdleri: ['s2'] })).toBe(
      'VARDIYA_DEGISTI',
    )
  })

  it('dilim SAYISI farklıysa (biri fazladan dilim eklemiş) VARDIYA_DEGISTI döner', () => {
    expect(
      personelAtamaDegisikligiSiniflandir({ ...temel, dilimIdleri: ['s1', 's2'] }, { guzergahId: 'g1', durakId: 'd1', dilimIdleri: ['s1'] }),
    ).toBe('VARDIYA_DEGISTI')
  })

  it('dilim SIRASI farklı ama SETİ aynıysa DIGER döner (sıradan bağımsız)', () => {
    expect(
      personelAtamaDegisikligiSiniflandir({ ...temel, dilimIdleri: ['s1', 's2'] }, { guzergahId: 'g1', durakId: 'd1', dilimIdleri: ['s2', 's1'] }),
    ).toBe('DIGER')
  })

  it('güzergah/durak/dilim TAMAMEN aynıysa DIGER döner', () => {
    expect(personelAtamaDegisikligiSiniflandir(temel, temel)).toBe('DIGER')
  })

  it('durakId null↔dolu geçişini de "değişiklik" sayar', () => {
    expect(personelAtamaDegisikligiSiniflandir({ ...temel, durakId: null }, { guzergahId: 'g1', durakId: 'd1', dilimIdleri: ['s1'] })).toBe(
      'DURAK_DEGISTI',
    )
  })
})

describe('kaynakDegistiMi', () => {
  it('önceki kayıt yoksa (ilk atama) false döner — bu bir "değişim" değil', () => {
    expect(kaynakDegistiMi(null, 'arac-1')).toBe(false)
  })

  it('önceki ile sonraki aynıysa false döner', () => {
    expect(kaynakDegistiMi('arac-1', 'arac-1')).toBe(false)
  })

  it('önceki ile sonraki farklıysa true döner', () => {
    expect(kaynakDegistiMi('arac-1', 'arac-2')).toBe(true)
  })
})

describe('buAyNeDegistiGetir', () => {
  const personnel = { adSoyad: 'Ahmet Yılmaz', sicilNo: '1234', bolum: 'Üretim' }
  const guzergahEski = { kod: 'GESKI', ad: 'Eski Güzergah' }
  const guzergahYeni = { kod: 'GYENI', ad: 'Yeni Güzergah' }

  it('bu ay hiç PERSONEL_ATAMA/ARAÇ/ŞOFÖR audit kaydı yoksa tüm listeler boş döner', async () => {
    const sonuc = await buAyNeDegistiGetir(2026, 3)
    expect(sonuc.yeniServisKullanicilari).toEqual([])
    expect(sonuc.servistenAyrilanlar).toEqual([])
    expect(sonuc.servisDegistirenler).toEqual([])
    expect(sonuc.durakDegistirenler).toEqual([])
    expect(sonuc.vardiyaDegistirenler).toEqual([])
    expect(sonuc.aracDegisenServisler).toEqual([])
    expect(sonuc.soforDegisenServisler).toEqual([])
    expect(sonuc.yil).toBe(2026)
    expect(sonuc.ay).toBe(3)
  })

  it('madde 7 (adres) her zaman kapsam-dışı placeholder, madde 5/6-sonrası kapasite alanları her zaman null', async () => {
    const sonuc = await buAyNeDegistiGetir(2026, 3)
    expect(sonuc.adresDegisiklikleri.kapsamDisi).toBe(true)
    expect(sonuc.yeniKapasiteRiskleri).toBeNull()
    expect(sonuc.bosalanKapasite).toBeNull()
  })

  it('madde 1 — önceki atama yoksa "yeni servis kullanıcısı" listesine düşer', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-1', islem: 'OLUSTURMA', tarih: new Date('2026-03-05') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-1', personnelId: 'p1', guzergahId: 'g1', durakId: 'd1',
        baslangicTarihi: new Date('2026-03-05'),
        personnel, guzergah: guzergahYeni, durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue(null) // önceki atama yok

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.yeniServisKullanicilari).toEqual([
      { personnelId: 'p1', adSoyad: 'Ahmet Yılmaz', sicilNo: '1234', bolum: 'Üretim', guzergahKod: 'GYENI', guzergahAd: 'Yeni Güzergah', tarih: new Date('2026-03-05') },
    ])
    expect(sonuc.servisDegistirenler).toEqual([])
  })

  it('madde 3 — önceki atama farklı güzergahtaysa "servis değiştiren" listesine düşer', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-2', islem: 'OLUSTURMA', tarih: new Date('2026-03-10') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-2', personnelId: 'p1', guzergahId: 'g2', durakId: 'd2',
        baslangicTarihi: new Date('2026-03-10'),
        personnel, guzergah: guzergahYeni, durak: { kod: 'D2', ad: 'Durak 2' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue({
      guzergahId: 'g1', durakId: 'd1', guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
      dilimler: [{ dilimId: 's1' }],
    })

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.servisDegistirenler).toEqual([
      {
        personnelId: 'p1', adSoyad: 'Ahmet Yılmaz', sicilNo: '1234', bolum: 'Üretim',
        eskiGuzergahKod: 'GESKI', eskiGuzergahAd: 'Eski Güzergah',
        yeniGuzergahKod: 'GYENI', yeniGuzergahAd: 'Yeni Güzergah',
        tarih: new Date('2026-03-10'),
      },
    ])
    expect(sonuc.yeniServisKullanicilari).toEqual([])
  })

  it('madde 4 — aynı güzergahta durak farklıysa "durak değiştiren" listesine düşer', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-3', islem: 'OLUSTURMA', tarih: new Date('2026-03-12') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-3', personnelId: 'p1', guzergahId: 'g1', durakId: 'd2',
        baslangicTarihi: new Date('2026-03-12'),
        personnel, guzergah: guzergahEski, durak: { kod: 'D2', ad: 'Durak 2' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue({
      guzergahId: 'g1', durakId: 'd1', guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
      dilimler: [{ dilimId: 's1' }],
    })

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.durakDegistirenler).toEqual([
      {
        personnelId: 'p1', adSoyad: 'Ahmet Yılmaz', sicilNo: '1234', bolum: 'Üretim',
        guzergahKod: 'GESKI', guzergahAd: 'Eski Güzergah',
        eskiDurakKod: 'D1', eskiDurakAd: 'Durak 1', yeniDurakKod: 'D2', yeniDurakAd: 'Durak 2',
        tarih: new Date('2026-03-12'),
      },
    ])
  })

  it('madde 8 — aynı güzergah+durak, dilim seti farklıysa "vardiya değiştiren" listesine düşer', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-4', islem: 'OLUSTURMA', tarih: new Date('2026-03-15') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-4', personnelId: 'p1', guzergahId: 'g1', durakId: 'd1',
        baslangicTarihi: new Date('2026-03-15'),
        personnel, guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilimId: 's2' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue({
      guzergahId: 'g1', durakId: 'd1', guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
      dilimler: [{ dilimId: 's1' }],
    })

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.vardiyaDegistirenler).toEqual([
      { personnelId: 'p1', adSoyad: 'Ahmet Yılmaz', sicilNo: '1234', bolum: 'Üretim', guzergahKod: 'GESKI', guzergahAd: 'Eski Güzergah', tarih: new Date('2026-03-15') },
    ])
  })

  it('hiçbir alan değişmemişse (DIGER) hiçbir listeye düşmez', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-5', islem: 'OLUSTURMA', tarih: new Date('2026-03-16') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-5', personnelId: 'p1', guzergahId: 'g1', durakId: 'd1',
        baslangicTarihi: new Date('2026-03-16'),
        personnel, guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue({
      guzergahId: 'g1', durakId: 'd1', guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
      dilimler: [{ dilimId: 's1' }],
    })

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.yeniServisKullanicilari).toEqual([])
    expect(sonuc.servisDegistirenler).toEqual([])
    expect(sonuc.durakDegistirenler).toEqual([])
    expect(sonuc.vardiyaDegistirenler).toEqual([])
  })

  it('madde 2 — ay sonu itibarıyla başka geçerli ataması YOKSA "ayrıldı" listesine düşer', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-6', islem: 'PASIFLESTIRME', tarih: new Date('2026-03-20') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-6', personnelId: 'p1', guzergahId: 'g1', durakId: 'd1',
        baslangicTarihi: new Date('2026-01-01'),
        personnel, guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue(null) // ay sonunda geçerli atama yok

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.servistenAyrilanlar).toEqual([
      { personnelId: 'p1', adSoyad: 'Ahmet Yılmaz', sicilNo: '1234', bolum: 'Üretim', guzergahKod: 'GESKI', guzergahAd: 'Eski Güzergah', tarih: new Date('2026-03-20') },
    ])
  })

  it('ay sonu itibarıyla başka geçerli ataması VARSA (transfer) "ayrıldı" SAYILMAZ', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-7', islem: 'PASIFLESTIRME', tarih: new Date('2026-03-20') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-7', personnelId: 'p1', guzergahId: 'g1', durakId: 'd1',
        baslangicTarihi: new Date('2026-01-01'),
        personnel, guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue({ id: 'atama-8' }) // ay sonunda geçerli başka atama VAR

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.servistenAyrilanlar).toEqual([])
  })

  it('DÜZELTME (Elif\'in sorusu üzerine): "ayrıldı" kontrolü aktif:true (canlı/şu an) DEĞİL, ay sonu tarihine göre (baslangicTarihi<=ayBitisi, bitisTarihi null veya >=ayBitisi) sorgulanır', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-10', islem: 'PASIFLESTIRME', tarih: new Date('2026-07-20') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-10', personnelId: 'p1', guzergahId: 'g1', durakId: 'd1',
        baslangicTarihi: new Date('2026-01-01'),
        personnel, guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue(null)

    await buAyNeDegistiGetir(2026, 7)

    const cagriParams = mocks.personelAtamaFindFirst.mock.calls[0][0]
    expect(cagriParams.where).not.toHaveProperty('aktif')
    expect(cagriParams.where.baslangicTarihi).toEqual({ lte: new Date('2026-07-31T23:59:59.999Z') })
    expect(cagriParams.where.OR).toEqual([{ bitisTarihi: null }, { bitisTarihi: { gte: new Date('2026-07-31T23:59:59.999Z') } }])
  })

  it('DÜZELTME/KANIT: geçmiş ayda ayrılan bir personel, rapor ÇALIŞTIRILDIĞI ANDA (ör. Kasım\'da) tekrar aktif bir atamaya sahip olsa bile, o geçmiş ay (Temmuz) için hâlâ "ayrıldı" sayılır — sorgu tarihsel, canlı DB durumuna bakmıyor', async () => {
    // Gerçek DB'de bu personelin Kasım'da açılan yeni ataması baslangicTarihi=2026-11-01'dir
    // ve `baslangicTarihi <= 2026-07-31` şartını SAĞLAMAZ — yani sorgu onu hiç göremez.
    // Mock, gerçek DB'nin bu filtreyle üreteceği sonucu (null) simüle ediyor.
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-11', islem: 'PASIFLESTIRME', tarih: new Date('2026-07-20') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-11', personnelId: 'p1', guzergahId: 'g1', durakId: 'd1',
        baslangicTarihi: new Date('2026-01-01'),
        personnel, guzergah: guzergahEski, durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue(null)

    const sonuc = await buAyNeDegistiGetir(2026, 7)

    expect(sonuc.servistenAyrilanlar).toHaveLength(1)
    expect(sonuc.servistenAyrilanlar[0].personnelId).toBe('p1')
  })

  it('DÜZELTME/KANIT: aynı personelin İKİ farklı ayda (Temmuz VE Ağustos) art arda transferi olsa bile, GEÇMİŞ ay (Temmuz) raporu yalnız Temmuz\'daki değişikliği yansıtır — Ağustos\'taki DAHA SONRAKİ değişiklik Temmuz sonucunu BOZMAZ', async () => {
    // A1 (Ocak, G1) → A2 (15 Temmuz, G1→G2 transferi, BU AY) → A3 (20 Ağustos,
    // G2→G3 transferi, RAPOR KAPSAMI DIŞINDA). "Önceki atama" sorgusu A2'nin KENDİ
    // baslangicTarihi'nden (15 Temmuz) önceki kaydı arar — A3 (20 Ağustos) bu şartı
    // (`baslangicTarihi < 2026-07-15`) hiç sağlamaz, sorgu ondan HABERSİZDİR.
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'PERSONEL_ATAMA'
        ? [{ hedefId: 'atama-temmuz', islem: 'OLUSTURMA', tarih: new Date('2026-07-15') }]
        : [],
    )
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'atama-temmuz', personnelId: 'p1', guzergahId: 'g2', durakId: 'd1',
        baslangicTarihi: new Date('2026-07-15'),
        personnel, guzergah: { kod: 'G2', ad: 'Güzergah 2' }, durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilimId: 's1' }],
      },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue({
      guzergahId: 'g1', durakId: 'd1', guzergah: { kod: 'G1', ad: 'Güzergah 1' }, durak: { kod: 'D1', ad: 'Durak 1' },
      dilimler: [{ dilimId: 's1' }],
    })

    const sonuc = await buAyNeDegistiGetir(2026, 7)

    expect(sonuc.servisDegistirenler).toEqual([
      {
        personnelId: 'p1', adSoyad: 'Ahmet Yılmaz', sicilNo: '1234', bolum: 'Üretim',
        eskiGuzergahKod: 'G1', eskiGuzergahAd: 'Güzergah 1',
        yeniGuzergahKod: 'G2', yeniGuzergahAd: 'Güzergah 2',
        tarih: new Date('2026-07-15'),
      },
    ])
    // Kanıt: sorgunun tarih çapası TEMMUZ 15'in KENDİSİ — "bugün"/sabit bir "şimdi"
    // değil. Ağustos'un (08-20) bu sorguya hiç girmediğini doğrudan gösterir.
    const cagriParams = mocks.personelAtamaFindFirst.mock.calls[0][0]
    expect(cagriParams.where.baslangicTarihi).toEqual({ lt: new Date('2026-07-15') })
  })

  it('madde 5 — aynı güzergah+dilim+rolde önceki araçtan farklıysa "araç değişti" listesine düşer', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'GUZERGAH_ARAC_VARSAYILAN'
        ? [{ hedefId: 'aav-2', islem: 'OLUSTURMA', tarih: new Date('2026-03-08') }]
        : [],
    )
    mocks.aracVarsayilanFindMany.mockResolvedValue([
      {
        id: 'aav-2', guzergahId: 'g1', dilimId: 's1', rol: 'ANA', aracId: 'arac-2',
        baslangicTarihi: new Date('2026-03-08'),
        guzergah: guzergahEski, dilim: { kod: 'S1' }, arac: { plaka: '41YENI' },
      },
    ])
    mocks.aracVarsayilanFindFirst.mockResolvedValue({ aracId: 'arac-1', arac: { plaka: '41ESKI' } })

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.aracDegisenServisler).toEqual([
      { guzergahKod: 'GESKI', guzergahAd: 'Eski Güzergah', dilimKod: 'S1', eskiPlaka: '41ESKI', yeniPlaka: '41YENI', tarih: new Date('2026-03-08') },
    ])
  })

  it('madde 5 — önceki araç kaydı yoksa (ilk atama) "araç değişti" listesine DÜŞMEZ', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'GUZERGAH_ARAC_VARSAYILAN'
        ? [{ hedefId: 'aav-3', islem: 'OLUSTURMA', tarih: new Date('2026-03-09') }]
        : [],
    )
    mocks.aracVarsayilanFindMany.mockResolvedValue([
      {
        id: 'aav-3', guzergahId: 'g1', dilimId: 's1', rol: 'ANA', aracId: 'arac-1',
        baslangicTarihi: new Date('2026-03-09'),
        guzergah: guzergahEski, dilim: { kod: 'S1' }, arac: { plaka: '41ILK' },
      },
    ])
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.aracDegisenServisler).toEqual([])
  })

  it('madde 6 — aynı güzergah+dilim+rolde önceki şoförden farklıysa "şoför değişti" listesine düşer', async () => {
    mocks.islemGecmisiFindMany.mockImplementation(async ({ where }: { where: { hedefTipi: string } }) =>
      where.hedefTipi === 'GUZERGAH_SOFOR_VARSAYILAN'
        ? [{ hedefId: 'gsv-1', islem: 'OLUSTURMA', tarih: new Date('2026-03-11') }]
        : [],
    )
    mocks.soforVarsayilanFindMany.mockResolvedValue([
      {
        id: 'gsv-1', guzergahId: 'g1', dilimId: 's1', rol: 'ANA', soforId: 'sofor-2',
        baslangicTarihi: new Date('2026-03-11'),
        guzergah: guzergahEski, dilim: { kod: 'S1' }, sofor: { adSoyad: 'Yeni Şoför' },
      },
    ])
    mocks.soforVarsayilanFindFirst.mockResolvedValue({ soforId: 'sofor-1', sofor: { adSoyad: 'Eski Şoför' } })

    const sonuc = await buAyNeDegistiGetir(2026, 3)

    expect(sonuc.soforDegisenServisler).toEqual([
      { guzergahKod: 'GESKI', guzergahAd: 'Eski Güzergah', dilimKod: 'S1', eskiAdSoyad: 'Eski Şoför', yeniAdSoyad: 'Yeni Şoför', tarih: new Date('2026-03-11') },
    ])
  })
})
