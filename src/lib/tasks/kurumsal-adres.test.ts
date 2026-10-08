import { describe, it, expect, vi, beforeEach } from 'vitest'

// prisma mock'u import'tan ÖNCE kurulmalı (kurumsal-adres modülü onu çağırıyor).
const userFindMany = vi.fn()
const personnelFindMany = vi.fn()
const userFindFirst = vi.fn()
const personnelFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: (...a: unknown[]) => userFindMany(...a),
      findFirst: (...a: unknown[]) => userFindFirst(...a),
    },
    personnel: {
      findMany: (...a: unknown[]) => personnelFindMany(...a),
      findUnique: (...a: unknown[]) => personnelFindUnique(...a),
    },
  },
}))

const { sorumlulariKurumsallastir, ilkSorumluAdresi, kurumsalAdresPersonelId, KURUMSAL_ALAN } =
  await import('./kurumsal-adres')

beforeEach(() => {
  userFindMany.mockReset()
  personnelFindMany.mockReset()
  userFindFirst.mockReset()
  personnelFindUnique.mockReset()
  userFindMany.mockResolvedValue([])
  personnelFindMany.mockResolvedValue([])
  userFindFirst.mockResolvedValue(null)
  personnelFindUnique.mockResolvedValue(null)
})

describe('personel seçilince adres kurumsal kaynaktan gelir', () => {
  it('User.email kurumsalsa gövdedeki KİŞİSEL adres yoksayılır', async () => {
    userFindMany.mockResolvedValue([{ employeeId: 'ILR-00825', email: 'gokce.eksioglu@ilerigroup.com' }])
    const sonuc = await sorumlulariKurumsallastir([
      // Olaydaki durum: forma/gövdeye kişisel adres gelmiş
      { name: 'GÖKÇE EKŞİOĞLU', email: 'gokcedemirkaya@hotmail.com', sicilNo: 'ILR-00825' },
    ])
    expect(sonuc).toEqual([
      { name: 'GÖKÇE EKŞİOĞLU', email: 'gokce.eksioglu@ilerigroup.com', sicilNo: 'ILR-00825' },
    ])
  })

  it('User kaydı yoksa azureAdEmail kullanılır', async () => {
    personnelFindMany.mockResolvedValue([{ sicilNo: 'ILR-1', azureAdEmail: 'Ad.Soyad@ilerigroup.com' }])
    const sonuc = await sorumlulariKurumsallastir([{ name: 'AD SOYAD', email: 'kisisel@gmail.com', sicilNo: 'ILR-1' }])
    expect(sonuc[0].email).toBe('ad.soyad@ilerigroup.com')
  })

  it('gövdeye elle yazılan adres KAYDA GEÇMEZ (elle değiştirilemez)', async () => {
    userFindMany.mockResolvedValue([{ employeeId: 'ILR-1', email: 'dogru.kisi@ilerigroup.com' }])
    const sonuc = await sorumlulariKurumsallastir([
      { name: 'AD SOYAD', email: 'baskasinin.adresi@ilerigroup.com', sicilNo: 'ILR-1' },
    ])
    expect(sonuc[0].email).toBe('dogru.kisi@ilerigroup.com')
  })
})

describe('kurumsal adresi olmayan personel', () => {
  it('SEÇİLEBİLİR ama adres null kalır (kişisel adres yazılmaz)', async () => {
    personnelFindMany.mockResolvedValue([{ sicilNo: 'ILR-2', azureAdEmail: null }])
    const sonuc = await sorumlulariKurumsallastir([
      { name: 'MAVİ YAKA', email: 'kisisel@hotmail.com', sicilNo: 'ILR-2' },
    ])
    expect(sonuc).toEqual([{ name: 'MAVİ YAKA', email: null, sicilNo: 'ILR-2' }])
  })

  it('kurumsal olmayan User.email de kabul edilmez', async () => {
    userFindMany.mockResolvedValue([{ employeeId: 'ILR-3', email: 'dis.firma@tedarikci.com' }])
    const sonuc = await sorumlulariKurumsallastir([{ name: 'X', email: 'x@x.com', sicilNo: 'ILR-3' }])
    expect(sonuc[0].email).toBeNull()
  })
})

describe('sicilsiz sorumlu', () => {
  it('kurumsal kaynakta arama anahtarı yok → gövdedeki değer KORUNUR', async () => {
    const girdi = [{ name: 'DIŞ KİŞİ', email: 'dis@tedarikci.com', sicilNo: null }]
    expect(await sorumlulariKurumsallastir(girdi)).toEqual(girdi)
    // Sicil yoksa DB'ye hiç gidilmez
    expect(userFindMany).not.toHaveBeenCalled()
    expect(personnelFindMany).not.toHaveBeenCalled()
  })

  it('boş liste DB sorgusu açmaz', async () => {
    expect(await sorumlulariKurumsallastir([])).toEqual([])
    expect(userFindMany).not.toHaveBeenCalled()
  })
})

describe('çoklu sorumlu', () => {
  it('her sicil kendi kurumsal adresini alır, sicilsiz olan korunur', async () => {
    userFindMany.mockResolvedValue([
      { employeeId: 'ILR-1', email: 'bir@ilerigroup.com' },
      { employeeId: 'ILR-2', email: 'iki@ilerigroup.com' },
    ])
    const sonuc = await sorumlulariKurumsallastir([
      { name: 'BİR', email: 'yanlis@gmail.com', sicilNo: 'ILR-1' },
      { name: 'İKİ', email: null, sicilNo: 'ILR-2' },
      { name: 'ÜÇ', email: 'dis@tedarikci.com', sicilNo: null },
    ])
    expect(sonuc.map((s) => s.email)).toEqual(['bir@ilerigroup.com', 'iki@ilerigroup.com', 'dis@tedarikci.com'])
    // Tek sorgu, mükerrer sicil tekilleşmiş
    expect(userFindMany).toHaveBeenCalledTimes(1)
  })

  it('tek alan (responsiblePersonEmail) ilk sorumludan türer', async () => {
    expect(ilkSorumluAdresi([{ name: 'A', email: 'A@Ilerigroup.COM' }])).toBe('a@ilerigroup.com')
    expect(ilkSorumluAdresi([{ name: 'A', email: null }])).toBeNull()
    expect(ilkSorumluAdresi([])).toBeNull()
  })

  it('kurumsal alan sabiti', () => {
    expect(KURUMSAL_ALAN).toBe('@ilerigroup.com')
  })
})

describe('kurumsalAdresPersonelId (KPI Aksiyonu yolu)', () => {
  it('User.email kurumsalsa onu döner, mailAdresi hiç okunmaz', async () => {
    personnelFindUnique.mockResolvedValue({ adSoyad: 'GÖKÇE EKŞİOĞLU', sicilNo: 'ILR-00825', azureAdEmail: null })
    userFindFirst.mockResolvedValue({ email: 'Gokce.Eksioglu@ilerigroup.com' })
    expect(await kurumsalAdresPersonelId('p-1')).toEqual({
      adSoyad: 'GÖKÇE EKŞİOĞLU',
      email: 'gokce.eksioglu@ilerigroup.com',
    })
    // select'te mailAdresi İSTENMİYOR
    expect(JSON.stringify(personnelFindUnique.mock.calls[0])).not.toContain('mailAdresi')
  })

  it('User yoksa azureAdEmail yedeği', async () => {
    personnelFindUnique.mockResolvedValue({ adSoyad: 'AD', sicilNo: null, azureAdEmail: 'ad@ilerigroup.com' })
    userFindFirst.mockResolvedValue(null)
    expect((await kurumsalAdresPersonelId('p-2')).email).toBe('ad@ilerigroup.com')
  })

  it('kurumsal adres yoksa null (ad yine döner, görev kaydedilir)', async () => {
    personnelFindUnique.mockResolvedValue({ adSoyad: 'MAVİ YAKA', sicilNo: 'ILR-9', azureAdEmail: null })
    userFindFirst.mockResolvedValue({ email: 'kisisel@gmail.com' })
    expect(await kurumsalAdresPersonelId('p-3')).toEqual({ adSoyad: 'MAVİ YAKA', email: null })
  })

  it('personnelId yoksa DB sorgusu acilmaz', async () => {
    expect(await kurumsalAdresPersonelId(null)).toEqual({ adSoyad: null, email: null })
    expect(personnelFindUnique).not.toHaveBeenCalled()
  })

  it('personel bulunamazsa ikisi de null', async () => {
    personnelFindUnique.mockResolvedValue(null)
    expect(await kurumsalAdresPersonelId('yok')).toEqual({ adSoyad: null, email: null })
  })
})
