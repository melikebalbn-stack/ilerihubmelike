import { describe, expect, it, vi } from 'vitest'
import { toplantiKullaniciIdCoz } from './kullanici-coz'
import { enumDogrula, TOPLANTI_TURLERI } from './hata'

/**
 * 28.09.2026 olayı: gündem maddesine "Sunucu" seçilmiş toplantı oluşturulamıyordu.
 * Seçici LDAP kaynağında `User.id` değil `distinguishedName` / `ldap_<user>`
 * döndürüyor, uç bunu çözümlemeden `presenterId`'ye yazıyor, FK ihlali TÜM
 * transaction'ı geri alıyordu (8 başarısız deneme, 0 kayıt).
 *
 * Buradaki testler o senaryoyu, uca gönderilen anahtar biçimleri üzerinden
 * sabitler. `toplantiKullaniciIdCoz` db'yi PARAMETRE aldığı için prisma
 * mock'lamaya gerek yok — sahte db doğrudan verilir.
 */

type SahteDb = Parameters<typeof toplantiKullaniciIdCoz>[0]

function sahteDb(kullanicilar: { id: string; email: string }[]) {
  const findUnique = vi.fn(async ({ where, select }: { where: { id?: string; email?: string }; select?: unknown }) => {
    void select
    const u = where.email
      ? kullanicilar.find((k) => k.email === where.email)
      : kullanicilar.find((k) => k.id === where.id)
    return u ? { id: u.id } : null
  })
  return { db: { user: { findUnique } } as unknown as SahteDb, findUnique }
}

const KULLANICILAR = [
  { id: 'ad_ahmet.cicek', email: 'ahmet.cicek@ilerigroup.com' },
  { id: 'ad_elif.karadeniz', email: 'elif.karadeniz@ilerigroup.com' },
]

describe('toplantiKullaniciIdCoz', () => {
  it('e-postayı User.id\'ye çevirir', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(toplantiKullaniciIdCoz(db, 'ahmet.cicek@ilerigroup.com')).resolves.toBe('ad_ahmet.cicek')
  })

  it('e-postayı küçük harfe indirir (seçici BÜYÜK harfle gönderebiliyor)', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(toplantiKullaniciIdCoz(db, 'Ahmet.Cicek@ILERIGROUP.com')).resolves.toBe('ad_ahmet.cicek')
  })

  it('LDAP distinguishedName için null döner — İSTEK PATLAMAZ', async () => {
    const { db } = sahteDb(KULLANICILAR)
    const dn = 'CN=Ahmet Cicek,OU=Kullanicilar,DC=ilerigroup,DC=com'
    await expect(toplantiKullaniciIdCoz(db, dn)).resolves.toBeNull()
  })

  it('ldap_<username> biçimi için null döner', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(toplantiKullaniciIdCoz(db, 'ldap_ahmet.cicek')).resolves.toBeNull()
  })

  it('gerçek User.id geçer (geriye dönük uyum)', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(toplantiKullaniciIdCoz(db, 'ad_elif.karadeniz')).resolves.toBe('ad_elif.karadeniz')
  })

  it('var olmayan id için null döner — varlık kontrolü yapılıyor', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(toplantiKullaniciIdCoz(db, 'ad_olmayan.kisi')).resolves.toBeNull()
  })

  it('boş / null / boşluk için DB\'ye hiç gitmez', async () => {
    const { db, findUnique } = sahteDb(KULLANICILAR)
    await expect(toplantiKullaniciIdCoz(db, null)).resolves.toBeNull()
    await expect(toplantiKullaniciIdCoz(db, undefined)).resolves.toBeNull()
    await expect(toplantiKullaniciIdCoz(db, '   ')).resolves.toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })
})

describe('gündem maddesi sunucusu — uç senaryosu', () => {
  /** POST /api/meetings'in gündem döngüsündeki çözüm adımının aynısı. */
  async function gundemPresenterId(db: SahteDb, item: { presenterEmail?: string | null; presenterId?: string | null }) {
    return toplantiKullaniciIdCoz(db, item.presenterEmail ?? item.presenterId)
  }

  it('sunucu seçilmiş madde: e-posta gelince gerçek id yazılır', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(
      gundemPresenterId(db, { presenterEmail: 'elif.karadeniz@ilerigroup.com' }),
    ).resolves.toBe('ad_elif.karadeniz')
  })

  it('eski istemci LDAP id gönderse bile kayıt null ile devam eder (FK ihlali YOK)', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(
      gundemPresenterId(db, { presenterId: 'CN=Ahmet Cicek,OU=Kullanicilar,DC=ilerigroup,DC=com' }),
    ).resolves.toBeNull()
  })

  it('e-posta, legacy presenterId\'den ÖNCE gelir', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(
      gundemPresenterId(db, {
        presenterEmail: 'ahmet.cicek@ilerigroup.com',
        presenterId: 'ldap_elif.karadeniz',
      }),
    ).resolves.toBe('ad_ahmet.cicek')
  })

  it('sunucu seçilmemiş madde: null, DB sorgusu yok', async () => {
    const { db, findUnique } = sahteDb(KULLANICILAR)
    await expect(gundemPresenterId(db, { presenterEmail: null, presenterId: null })).resolves.toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })
})

describe('enumDogrula — meetingType', () => {
  it('geçerli değeri geçirir', () => {
    const r = enumDogrula('meetingType', 'TRAINING', TOPLANTI_TURLERI)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.deger).toBe('TRAINING')
  })

  it('tanımsız değeri geçirir (alan opsiyonel)', () => {
    const r = enumDogrula('meetingType', undefined, TOPLANTI_TURLERI)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.deger).toBeUndefined()
  })

  it('geçersiz enum 400 döner ve alan adını söyler (03.09.2026: "SUPPLIER")', async () => {
    const r = enumDogrula('meetingType', 'SUPPLIER', TOPLANTI_TURLERI)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.yanit.status).toBe(400)
      const govde = await r.yanit.json()
      expect(govde.alan).toBe('meetingType')
      expect(govde.error).toContain('SUPPLIER')
    }
  })
})
