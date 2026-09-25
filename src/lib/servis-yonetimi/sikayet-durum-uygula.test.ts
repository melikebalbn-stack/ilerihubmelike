import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServisSikayetDurumu } from '@/generated/prisma'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  gecmisCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    servisSikayet: { findUnique: mocks.findUnique, update: mocks.update },
    servisIslemGecmisi: { create: mocks.gecmisCreate },
  },
}))

// audit.ts MOCK'LANMIYOR — gerçek kaydetIslemGecmisi/degisenAlanlar koşsun;
// böylece oncekiDeger/yeniDeger'in gerçekten ne yazdığı görülür.
import { sikayetDurumDegistir } from './sikayet-durum-uygula'
import { SikayetError } from './sikayet'

const T_AKSIYON = new Date('2026-09-20T00:00:00.000Z')
const T_KAPANIS = new Date('2026-09-24T00:00:00.000Z')

type Kayit = {
  id: string
  durum: ServisSikayetDurumu
  aksiyon?: string | null
  aksiyonTarihi?: Date | null
  kapanisTarihi?: Date | null
  kapanisNotu?: string | null
}

/** tx client + çağrı izi. Update ve tarihçe AYNI client'ta olmalı. */
function txKur(iz: string[], gecmisHata?: Error) {
  const tx = {
    servisSikayet: {
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        iz.push('tx.sikayet.update')
        return { id: 's1', ...a.data }
      }),
    },
    servisIslemGecmisi: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        iz.push('tx.islemGecmisi.create')
        if (gecmisHata) throw gecmisHata
        return { id: 'g1', ...a.data }
      }),
    },
  }
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
  return tx
}

function kayitKur(k: Kayit) {
  mocks.findUnique.mockResolvedValue({
    aksiyon: null, aksiyonTarihi: null, kapanisTarihi: null, kapanisNotu: null, termin: null, ...k,
  })
}

/** Tarihçe create çağrısındaki data. */
function gecmisVerisi(tx: ReturnType<typeof txKur>) {
  return tx.servisIslemGecmisi.create.mock.calls[0][0].data as {
    hedefTipi: string; hedefId: string; islem: string; userId: string | null
    oncekiDeger: Record<string, unknown>; yeniDeger: Record<string, unknown>
  }
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
})

// ----------------------------------------------------------------------------
// Matristeki 6 geçiş — her biri tarihçe satırı yazıyor
// ----------------------------------------------------------------------------
describe('matristeki 6 geçiş — her biri tarihçeye yazılıyor', () => {
  const GECISLER: { from: ServisSikayetDurumu; to: ServisSikayetDurumu; mevcut: Partial<Kayit>; alanlar: Record<string, unknown> }[] = [
    { from: 'ACIK', to: 'AKSIYON_ALINDI', mevcut: {}, alanlar: { aksiyon: 'Firmaya bildirildi', aksiyonTarihi: T_AKSIYON } },
    { from: 'ACIK', to: 'REDDEDILDI', mevcut: {}, alanlar: { kapanisTarihi: T_KAPANIS, kapanisNotu: 'Yersiz bulundu.' } },
    { from: 'AKSIYON_ALINDI', to: 'KAPANDI', mevcut: { aksiyon: 'Bildirildi', aksiyonTarihi: T_AKSIYON }, alanlar: { kapanisTarihi: T_KAPANIS } },
    { from: 'AKSIYON_ALINDI', to: 'REDDEDILDI', mevcut: { aksiyon: 'Bildirildi', aksiyonTarihi: T_AKSIYON }, alanlar: { kapanisTarihi: T_KAPANIS, kapanisNotu: 'İnceleme sonucu yersiz.' } },
    { from: 'KAPANDI', to: 'ACIK', mevcut: { aksiyon: 'Bildirildi', aksiyonTarihi: T_AKSIYON, kapanisTarihi: T_KAPANIS }, alanlar: {} },
    { from: 'REDDEDILDI', to: 'ACIK', mevcut: { kapanisTarihi: T_KAPANIS, kapanisNotu: 'Yersiz.' }, alanlar: {} },
  ]

  for (const g of GECISLER) {
    it(`${g.from} → ${g.to}: tarihçe satırı yazılır, hedefTipi/hedefId/eski/yeni doğru`, async () => {
      const iz: string[] = []
      const tx = txKur(iz)
      kayitKur({ id: 's1', durum: g.from, ...g.mevcut })

      await sikayetDurumDegistir({ sikayetId: 's1', yeniDurum: g.to, alanlar: g.alanlar, userId: 'u1' })

      expect(tx.servisIslemGecmisi.create).toHaveBeenCalledTimes(1)
      const d = gecmisVerisi(tx)
      expect(d.hedefTipi).toBe('SIKAYET')
      expect(d.hedefId).toBe('s1')
      expect(d.islem).toBe('GUNCELLEME')
      expect(d.userId).toBe('u1')
      // Durum değişimi her zaman eski/yeni olarak kayda geçer
      expect(d.oncekiDeger.durum).toBe(g.from)
      expect(d.yeniDeger.durum).toBe(g.to)
    })
  }
})

// ----------------------------------------------------------------------------
// 🔴 Reddedilen geçiş — NE update NE tarihçe
// ----------------------------------------------------------------------------
describe('reddedilen geçişte hiçbir yazma olmaz', () => {
  it('🔴 ACIK → KAPANDI: ne update ne tarihçe, transaction bile açılmaz', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({ id: 's1', durum: 'ACIK' })

    await expect(
      sikayetDurumDegistir({ sikayetId: 's1', yeniDurum: 'KAPANDI', alanlar: { kapanisTarihi: T_KAPANIS }, userId: 'u1' }),
    ).rejects.toThrow(SikayetError)

    expect(tx.servisSikayet.update).not.toHaveBeenCalled()
    expect(tx.servisIslemGecmisi.create).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(iz).toEqual([])
  })

  it('alan tutarlılığı düşerse de (gerekçesiz ret) hiçbir yazma olmaz', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({ id: 's1', durum: 'ACIK' })

    await expect(
      sikayetDurumDegistir({ sikayetId: 's1', yeniDurum: 'REDDEDILDI', alanlar: { kapanisTarihi: T_KAPANIS }, userId: 'u1' }),
    ).rejects.toThrow(/ret gerekçesi/)

    expect(tx.servisSikayet.update).not.toHaveBeenCalled()
    expect(tx.servisIslemGecmisi.create).not.toHaveBeenCalled()
  })

  it('kayıt yoksa anlaşılır hata, yazma yok', async () => {
    txKur([])
    mocks.findUnique.mockResolvedValue(null)
    await expect(sikayetDurumDegistir({ sikayetId: 'yok', yeniDurum: 'AKSIYON_ALINDI' })).rejects.toThrow('bulunamadı')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// 🔴 ASKIDAKİ ŞART — Adım 1'in kararının kanıtı
// ----------------------------------------------------------------------------
describe('yeniden açılış — Adım 1 kararının kanıtı', () => {
  it('🔴 REDDEDILDI → ACIK: kapanisTarihi null OLDU · aksiyonTarihi KORUNDU · kapanisNotu tarihçede ESKİ DEĞER (üçü aynı testte)', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({
      id: 's1', durum: 'REDDEDILDI',
      aksiyon: 'İnceleme yapıldı', aksiyonTarihi: T_AKSIYON,
      kapanisTarihi: T_KAPANIS, kapanisNotu: 'Yersiz bulundu.',
    })

    await sikayetDurumDegistir({ sikayetId: 's1', yeniDurum: 'ACIK', userId: 'u1' })

    // (1) kapanisTarihi temizlendi
    const yazilan = tx.servisSikayet.update.mock.calls[0][0].data
    expect(yazilan.kapanisTarihi).toBeNull()
    expect(yazilan.kapanisNotu).toBeNull()

    // (2) aksiyon izi KORUNDU
    expect(yazilan.aksiyonTarihi).toBe(T_AKSIYON)
    expect(yazilan.aksiyon).toBe('İnceleme yapıldı')

    // (3) 🔴 kapanisNotu tarihçede ESKİ DEĞER olarak duruyor — Adım 1'de
    //     "tarihsel iz tarihçede kalır" gerekçesinin kanıtı.
    const d = gecmisVerisi(tx)
    expect(d.oncekiDeger.kapanisNotu).toBe('Yersiz bulundu.')
    expect(d.yeniDeger.kapanisNotu).toBeNull()
    expect(d.oncekiDeger.kapanisTarihi).toBe(T_KAPANIS)
  })

  it('KAPANDI → ACIK: kapanış notu yoksa bile aksiyon izi korunur ve tarihçe kapanış tarihini taşır', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({
      id: 's1', durum: 'KAPANDI',
      aksiyon: 'Sürücü uyarıldı', aksiyonTarihi: T_AKSIYON, kapanisTarihi: T_KAPANIS,
    })

    await sikayetDurumDegistir({ sikayetId: 's1', yeniDurum: 'ACIK', userId: 'u1' })

    const yazilan = tx.servisSikayet.update.mock.calls[0][0].data
    expect(yazilan.kapanisTarihi).toBeNull()
    expect(yazilan.aksiyonTarihi).toBe(T_AKSIYON)

    const d = gecmisVerisi(tx)
    expect(d.oncekiDeger.kapanisTarihi).toBe(T_KAPANIS)
    // aksiyonTarihi DEĞİŞMEDİĞİ için tarihçeye hiç girmez (yalnız değişen alanlar)
    expect(d.oncekiDeger.aksiyonTarihi).toBeUndefined()
    expect(d.yeniDeger.aksiyonTarihi).toBeUndefined()
  })
})

// ----------------------------------------------------------------------------
// 🔴 FAIL-CLOSED — aynı transaction, hata yutulmuyor
// ----------------------------------------------------------------------------
describe('fail-closed: update ve tarihçe aynı transaction', () => {
  it('🔴 ikisi de AYNI tx client üzerinde, modül seviyesindeki prisma kullanılmıyor', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({ id: 's1', durum: 'ACIK' })

    await sikayetDurumDegistir({
      sikayetId: 's1', yeniDurum: 'AKSIYON_ALINDI',
      alanlar: { aksiyon: 'Bildirildi', aksiyonTarihi: T_AKSIYON }, userId: 'u1',
    })

    expect(tx.servisSikayet.update).toHaveBeenCalledTimes(1)
    expect(tx.servisIslemGecmisi.create).toHaveBeenCalledTimes(1)
    // Transaction DIŞINDAKİ prisma'ya dokunulmadı
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.gecmisCreate).not.toHaveBeenCalled()
    // Sıra: önce update, sonra tarihçe — ikisi de tx üzerinde
    expect(iz).toEqual(['tx.sikayet.update', 'tx.islemGecmisi.create'])
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })

  it('🔴 tarihçe yazımı PATLARSA hata YUTULMAZ — transaction geri alınır', async () => {
    const iz: string[] = []
    const tx = txKur(iz, new Error('tarihçe yazılamadı'))
    kayitKur({ id: 's1', durum: 'ACIK' })

    await expect(
      sikayetDurumDegistir({
        sikayetId: 's1', yeniDurum: 'AKSIYON_ALINDI',
        alanlar: { aksiyon: 'Bildirildi', aksiyonTarihi: T_AKSIYON }, userId: 'u1',
      }),
    ).rejects.toThrow('tarihçe yazılamadı')

    // Update çağrıldı ama hata transaction'dan DIŞARI çıktı → rollback.
    // (Gerçek prisma'da $transaction geri alır; burada hatanın yutulmadığı
    //  kanıtlanıyor — madde 49'daki fail-open desenine uyulmadı.)
    expect(tx.servisSikayet.update).toHaveBeenCalledTimes(1)
    expect(iz).toEqual(['tx.sikayet.update', 'tx.islemGecmisi.create'])
  })

  it('updatedById her geçişte yazılır', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({ id: 's1', durum: 'ACIK' })

    await sikayetDurumDegistir({ sikayetId: 's1', yeniDurum: 'REDDEDILDI', alanlar: { kapanisTarihi: T_KAPANIS, kapanisNotu: 'Yersiz.' }, userId: 'u9' })
    expect(tx.servisSikayet.update.mock.calls[0][0].data.updatedById).toBe('u9')
  })

  it('aciklama verilirse tarihçeye düşer', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({ id: 's1', durum: 'ACIK' })

    await sikayetDurumDegistir({
      sikayetId: 's1', yeniDurum: 'AKSIYON_ALINDI',
      alanlar: { aksiyon: 'Bildirildi', aksiyonTarihi: T_AKSIYON },
      userId: 'u1', aciklama: 'Firma telefonla arandı',
    })
    expect(tx.servisIslemGecmisi.create.mock.calls[0][0].data.aciklama).toBe('Firma telefonla arandı')
  })
})

// ----------------------------------------------------------------------------
// Tarihçe kapsamı (KVKK / madde 23)
// ----------------------------------------------------------------------------
describe('tarihçe kapsamı', () => {
  it('yalnız DEĞİŞEN alanlar yazılır, tam satır değil', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    // aksiyon zaten mevcut ve AYNI değerle gönderiliyor → değişmemiş sayılmalı
    kayitKur({ id: 's1', durum: 'ACIK', aksiyon: 'Bildirildi' })

    await sikayetDurumDegistir({
      sikayetId: 's1', yeniDurum: 'AKSIYON_ALINDI',
      alanlar: { aksiyon: 'Bildirildi', aksiyonTarihi: T_AKSIYON },
      userId: 'u1',
    })

    const d = gecmisVerisi(tx)
    // aksiyon değişmedi → tarihçeye girmedi
    expect(d.oncekiDeger.aksiyon).toBeUndefined()
    expect(Object.keys(d.yeniDeger).sort()).toEqual(['aksiyonTarihi', 'durum'])
  })

  it('termin durum geçişi tarihçesine KARIŞMAZ (bu akışın alanı değil)', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({ id: 's1', durum: 'ACIK' })

    await sikayetDurumDegistir({
      sikayetId: 's1', yeniDurum: 'AKSIYON_ALINDI',
      alanlar: { aksiyon: 'Bildirildi', aksiyonTarihi: T_AKSIYON }, userId: 'u1',
    })

    const yazilan = tx.servisSikayet.update.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(yazilan, 'termin')).toBe(false)
    const d = gecmisVerisi(tx)
    expect(d.oncekiDeger.termin).toBeUndefined()
    expect(d.yeniDeger.termin).toBeUndefined()
  })

  it('tarihçeye kişisel veri/JOIN alanı yazılmaz (yalnız kendi skaler alanları)', async () => {
    const iz: string[] = []
    const tx = txKur(iz)
    kayitKur({ id: 's1', durum: 'ACIK' })

    await sikayetDurumDegistir({ sikayetId: 's1', yeniDurum: 'REDDEDILDI', alanlar: { kapanisTarihi: T_KAPANIS, kapanisNotu: 'Yersiz.' }, userId: 'u1' })

    const d = gecmisVerisi(tx)
    const tumAnahtarlar = [...Object.keys(d.oncekiDeger), ...Object.keys(d.yeniDeger)]
    expect(tumAnahtarlar.filter(k => /sikayetci|adSoyad|sicilNo|telefon|personnel/i.test(k))).toEqual([])
  })
})
