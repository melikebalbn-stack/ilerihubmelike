import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Kişi bazlı yönetici (onaycı) çözümü — KARAKTERİZASYON testleri. Kart Okutamama'dan ortak modüle
 * taşınırken davranışın DEĞİŞMEDİĞİNİ sabitler (aynı testler taşıma öncesi eski konumda da geçti).
 * Prisma bellek içi sahte DB ile taklit edilir; ad eşleşmesi gerçek adNormalize ile çalışır.
 */

type P = {
  id: string; adSoyad: string; aktif: boolean; sicilNo?: string | null; bolum?: string | null
  birimSorumlusu?: string | null; sorumlu2?: string | null; sorumlu3?: string | null
  sorumlu1Id?: string | null; sorumlu2Id?: string | null; sorumlu3Id?: string | null
}
const db = vi.hoisted(() => ({
  personeller: [] as P[],
  kullanicilar: [] as { id: string; personnelId: string }[],
  bolumler: [] as { name: string; mudurId: string | null; mudurYardimcisiId: string | null }[],
  ayarlar: new Map<string, string>(),
  hataVer: false,
}))

vi.mock('@/lib/prisma', () => {
  const userOf = (pid: string | null | undefined) => {
    const u = db.kullanicilar.find((k) => k.personnelId === pid)
    return u ? { id: u.id } : null
  }
  const ref = (pid: string | null | undefined) => {
    const p = db.personeller.find((x) => x.id === pid)
    return p ? { aktif: p.aktif, user: userOf(p.id) } : null
  }
  return {
    prisma: {
      personnel: {
        findUnique: async ({ where, select }: { where: { id: string }; select: Record<string, unknown> }) => {
          const p = db.personeller.find((x) => x.id === where.id)
          if (!p) return null
          if ('sorumlu1' in select) {
            return {
              birimSorumlusu: p.birimSorumlusu ?? null, sorumlu2: p.sorumlu2 ?? null, sorumlu3: p.sorumlu3 ?? null, bolum: p.bolum ?? null,
              sorumlu1: ref(p.sorumlu1Id), sorumlu2Ref: ref(p.sorumlu2Id), sorumlu3Ref: ref(p.sorumlu3Id),
            }
          }
          return { adSoyad: p.adSoyad, sicilNo: p.sicilNo ?? null }
        },
        findMany: async ({ where }: { where: { aktif?: boolean; id?: { not: string } } }) =>
          db.personeller
            .filter((p) => (where.aktif === undefined || p.aktif === where.aktif) && (!where.id || p.id !== where.id.not))
            .map((p) => ({
              id: p.id, adSoyad: p.adSoyad, user: userOf(p.id),
              birimSorumlusu: p.birimSorumlusu ?? null, sorumlu2: p.sorumlu2 ?? null, sorumlu3: p.sorumlu3 ?? null,
            })),
        findFirst: async ({ where }: { where: { id: string; aktif: boolean } }) => {
          const p = db.personeller.find((x) => x.id === where.id && x.aktif === where.aktif)
          return p ? { user: userOf(p.id) } : null
        },
      },
      user: { findFirst: async ({ where }: { where: { personnelId: string } }) => userOf(where.personnelId) },
      departmentDefinition: {
        findMany: async () => db.bolumler,
        count: async ({ where }: { where: { mudurId: string } }) => {
          if (db.hataVer) throw new Error('db yok')
          return db.bolumler.filter((b) => b.mudurId === where.mudurId).length
        },
      },
      systemSetting: { findUnique: async ({ where }: { where: { key: string } }) => (db.ayarlar.has(where.key) ? { value: db.ayarlar.get(where.key)! } : null) },
    },
  }
})

import { adEsit, getManagedPersonnelIds, resolveApprovers } from '@/lib/onay/yonetici-cozumu'
import { selfEntryOnaydanMuafMi } from '@/lib/onay/muafiyet'
import { onayKarariBelirle } from '@/app/api/toplu-kart-okutamama/_lib/approvers'

const kisi = (p: P, userId?: string) => {
  db.personeller.push(p)
  if (userId) db.kullanicilar.push({ id: userId, personnelId: p.id })
}
beforeEach(() => {
  db.personeller = []
  db.kullanicilar = []
  db.bolumler = []
  db.ayarlar = new Map()
  db.hataVer = false
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  kisi({ id: 'm1', adSoyad: 'Ayşe Yılmaz', aktif: true }, 'u-m1')
  kisi({ id: 'm2', adSoyad: 'Bedri Güler', aktif: true }, 'u-m2')
  kisi({ id: 'm3', adSoyad: 'Can Demir', aktif: true }, 'u-m3')
})

describe('resolveApprovers', () => {
  it('önce sorumlu1-3Id FK yolu', async () => {
    kisi({ id: 'c', adSoyad: 'Çalışan', aktif: true, sorumlu1Id: 'm1', sorumlu2Id: 'm2' }, 'u-c')
    expect(await resolveApprovers('c')).toEqual({ approverId: 'u-m1', approverId2: 'u-m2', approverId3: null })
  })

  it('FK boş ya da bağlı kişi pasifse ad yoluna düşer; ad eşleşmesi vekâlet eki ve Türkçe harf farkını tolere eder', async () => {
    db.personeller.find((p) => p.id === 'm3')!.aktif = false
    kisi({ id: 'c', adSoyad: 'Çalışan', aktif: true, sorumlu1Id: 'm3', birimSorumlusu: 'V.BEDRİ GÜLER', sorumlu2: 'ayse yilmaz' }, 'u-c')
    expect(await resolveApprovers('c')).toEqual({ approverId: 'u-m2', approverId2: 'u-m1', approverId3: null })
    expect(adEsit('V.BEDRİ GÜLER', 'Bedri Güler')).toBe(true)
  })

  it('belirsiz ad (iki aktif eşleşme) atama YAPMAZ', async () => {
    kisi({ id: 'm1b', adSoyad: 'AYŞE YILMAZ', aktif: true }, 'u-m1b')
    kisi({ id: 'c', adSoyad: 'Çalışan', aktif: true, birimSorumlusu: 'Ayşe Yılmaz', sorumlu2: 'Can Demir' }, 'u-c')
    expect(await resolveApprovers('c')).toEqual({ approverId: null, approverId2: 'u-m3', approverId3: null })
  })

  it('aynı kişi iki slota çözülürse tekrarı boş bırakır', async () => {
    kisi({ id: 'c', adSoyad: 'Çalışan', aktif: true, sorumlu1Id: 'm1', sorumlu2: 'Ayşe Yılmaz', sorumlu3Id: 'm2' }, 'u-c')
    expect(await resolveApprovers('c')).toEqual({ approverId: 'u-m1', approverId2: null, approverId3: 'u-m2' })
  })

  it('kişi kendi sorumlusuysa kendi kaydını ONAYLAYAMAZ (slot boşalır)', async () => {
    kisi({ id: 'c', adSoyad: 'Deniz Ak', aktif: true, sorumlu1Id: 'c', sorumlu2Id: 'm2' }, 'u-c')
    expect(await resolveApprovers('c')).toEqual({ approverId: null, approverId2: 'u-m2', approverId3: null })
  })

  it('üç slot da çözülemezse bölüm müdürü, o yoksa müdür yardımcısı (fallbackKullanildi)', async () => {
    db.bolumler.push({ name: 'Kalite Müdürlüğü', mudurId: 'm3', mudurYardimcisiId: 'm2' })
    kisi({ id: 'c', adSoyad: 'Çalışan', aktif: true, bolum: 'KALİTE MÜDÜRLÜĞÜ' }, 'u-c')
    expect(await resolveApprovers('c')).toEqual({ approverId: 'u-m3', approverId2: null, approverId3: null, fallbackKullanildi: true })
    db.personeller.find((p) => p.id === 'm3')!.aktif = false
    expect(await resolveApprovers('c')).toEqual({ approverId: 'u-m2', approverId2: null, approverId3: null, fallbackKullanildi: true })
  })

  it('bölüm müdürü kişinin kendisiyse fallback de uygulanmaz → orphan (üçü null)', async () => {
    db.bolumler.push({ name: 'Kalite', mudurId: 'c', mudurYardimcisiId: null })
    kisi({ id: 'c', adSoyad: 'Çalışan', aktif: true, bolum: 'Kalite' }, 'u-c')
    expect(await resolveApprovers('c')).toEqual({ approverId: null, approverId2: null, approverId3: null })
  })

  it('hiçbir aday yoksa orphan; kişi yoksa da üçü null', async () => {
    kisi({ id: 'c', adSoyad: 'Çalışan', aktif: true, birimSorumlusu: 'Olmayan Kişi' }, 'u-c')
    expect(await resolveApprovers('c')).toEqual({ approverId: null, approverId2: null, approverId3: null })
    expect(await resolveApprovers('yok')).toEqual({ approverId: null, approverId2: null, approverId3: null })
  })
})

describe('muafiyet (müdür / kişiye özel liste)', () => {
  it('şemada departman müdürü → muaf; sicil listede → muaf; değilse değil; hata → fail-closed', async () => {
    db.bolumler.push({ name: 'X', mudurId: 'm1', mudurYardimcisiId: null })
    kisi({ id: 's1', adSoyad: 'Liste', aktif: true, sicilNo: 'ILR-00042' })
    db.ayarlar.set('kart_okutamama_muaf_siciller', ' ilr-00042 , ILR-00099')
    expect(await selfEntryOnaydanMuafMi('m1')).toBe(true)
    expect(await selfEntryOnaydanMuafMi('s1')).toBe(true)
    expect(await selfEntryOnaydanMuafMi('m2')).toBe(false)
    db.hataVer = true
    expect(await selfEntryOnaydanMuafMi('m1')).toBe(false)
  })
})

describe('onayKarariBelirle (Kart Okutamama kuralı — yerinde kaldı)', () => {
  it('başkası adına → ONAYLANDI onaycısız; kendi + muaf → ONAYLANDI; kendi + muaf değil → BEKLIYOR + onaycılar', async () => {
    kisi({ id: 'c', adSoyad: 'Çalışan', aktif: true, sorumlu1Id: 'm2' }, 'u-c')
    const bos = { onayDurumu: 'ONAYLANDI', approverId: null, approverId2: null, approverId3: null }
    expect(await onayKarariBelirle('c', 'm1')).toEqual(bos)
    expect(await onayKarariBelirle('c', null)).toEqual(bos)
    expect(await onayKarariBelirle('c', 'c')).toEqual({ onayDurumu: 'BEKLIYOR', approverId: 'u-m2', approverId2: null, approverId3: null })
    db.bolumler.push({ name: 'Y', mudurId: 'c', mudurYardimcisiId: null })
    expect(await onayKarariBelirle('c', 'c')).toEqual(bos)
  })
})

describe('getManagedPersonnelIds (ekip)', () => {
  it('adı başka aktif kişilerin 1./2./3. Sorumlu alanında geçenler — vekâlet eki dahil', async () => {
    kisi({ id: 'e1', adSoyad: 'E1', aktif: true, birimSorumlusu: 'V.BEDRİ GÜLER' })
    kisi({ id: 'e2', adSoyad: 'E2', aktif: true, sorumlu3: 'bedri güler' })
    kisi({ id: 'e3', adSoyad: 'E3', aktif: false, sorumlu2: 'Bedri Güler' })
    kisi({ id: 'e4', adSoyad: 'E4', aktif: true, sorumlu2: 'Ayşe Yılmaz' })
    expect(await getManagedPersonnelIds('m2')).toEqual(['e1', 'e2'])
    expect(await getManagedPersonnelIds('yok')).toEqual([])
  })
})
