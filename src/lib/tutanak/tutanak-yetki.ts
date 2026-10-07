/**
 * IV-FR-03 Tutanak Formu — YETKİ TEK KAYNAĞI.
 *
 * AÇMA   : bir bölümün müdürü / müdür yrd. (kendi bölümü + ALT AĞACI için)
 *          ∨ İnsan Varlıkları (herkes için) ∨ platform yöneticisi (herkes için)
 * GÖRME  : oluşturan ∨ şahitlerden biri ∨ seçilen yönetici ∨ bilgilendirilen son
 *          yönetici ∨ İV ∨ platform yöneticisi
 * GÖRMEZ : HAKKINDA TUTANAK TUTULAN PERSONEL — başka bir yolla (şahit, yönetici)
 *          girse bile görmez; bu kural diğer tüm yolların ÜSTÜNDEDİR.
 * ONAY   : yalnız o adımın sahibi (adimSahibi). Platform yöneticisi bypass'ı
 *          YOKTUR — §3 kararı: platform kuralı yalnız görüntüleme açar.
 *
 * İV kümesi bölüm-talep ucuyla birebir aynı: rol ∈ {ADMIN, HR_MANAGER,
 * SUPER_ADMIN} ∨ departman = İnsan Varlıkları. Müdür/müdür-yrd kararı DAİMA
 * Personnel FK'sı üzerinden; LDAP department metni yalnız İV tespitinde kullanılır.
 */

import { prisma } from '@/lib/prisma'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { resolveMudurKoltukDeptler } from '@/lib/overtime-performance'
import { platformYoneticiIdMi } from '@/lib/auth/platform-yonetici'
import { adimSahibi, type AdimSahibi } from './tutanak-durum'
import type { TutanakDurum, TutanakSahitDurum } from '@/generated/prisma'

const IV_ROLLERI = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

export type TutanakAcanRolu = 'MUDUR' | 'MUDUR_YRD' | 'IV'

export interface TutanakYetki {
  userId: string
  personnelId: string | null
  iv: boolean
  /** Müdür/müdür-yrd koltuğu; İV'de null olabilir. */
  koltukRol: 'MUDUR' | 'MUDUR_YRD' | null
  /** Tutanak açılabilecek bölümler. İV/platform → tüm aktif bölümler. */
  kapsamBolumler: { id: string; name: string }[]
  /** Kapsam tüm bölümler mi (İV/platform) — personel seçicide süzgeç uygulanmaz. */
  tumBolumler: boolean
  acabilir: boolean
  erisebilir: boolean
  platformBypass: boolean
  /** Kayda yazılacak açan rolü. */
  acanRol: TutanakAcanRolu | null
}

export function tutanakIvMi(role: string | null | undefined, department: string | null | undefined): boolean {
  return IV_ROLLERI.includes(role ?? '') || isInsanVarliklari(department)
}

export async function tutanakYetkisiCore(
  userId: string,
  role: string | null | undefined,
  department: string | null | undefined,
): Promise<TutanakYetki> {
  const iv = tutanakIvMi(role, department)
  const platformBypass = platformYoneticiIdMi(userId)

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { personnelId: true } })
  const personnelId = u?.personnelId ?? null

  let koltukRol: 'MUDUR' | 'MUDUR_YRD' | null = null
  if (personnelId) {
    const dept = await prisma.departmentDefinition.findFirst({
      where: { OR: [{ mudurId: personnelId }, { mudurYardimcisiId: personnelId }] },
      select: { mudurId: true, mudurYardimcisiId: true },
    })
    if (dept?.mudurId === personnelId) koltukRol = 'MUDUR'
    else if (dept?.mudurYardimcisiId === personnelId) koltukRol = 'MUDUR_YRD'
  }

  // İV ve platform yöneticisi herkes için tutanak açabilir → kapsam tüm bölümler.
  if (iv || platformBypass) {
    const hepsi = await prisma.departmentDefinition.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return {
      userId,
      personnelId,
      iv,
      koltukRol,
      kapsamBolumler: hepsi,
      tumBolumler: true,
      acabilir: true,
      erisebilir: true,
      platformBypass,
      // İV kaydı IV rolüyle açar; koltuk sahibi İV ise koltuk rolü yazılır
      // (kâğıt formda "tutanağı tutan" alanı bu bilgiyi taşıyor).
      acanRol: koltukRol ?? 'IV',
    }
  }

  const kapsamBolumler = koltukRol ? await resolveMudurKoltukDeptler(userId) : []
  return {
    userId,
    personnelId,
    iv: false,
    koltukRol,
    kapsamBolumler,
    tumBolumler: false,
    acabilir: koltukRol !== null && kapsamBolumler.length > 0,
    erisebilir: koltukRol !== null,
    platformBypass: false,
    acanRol: koltukRol,
  }
}

/** Tutanağın görünürlük/onay kararı için gereken asgari alanlar. */
export type TutanakKimlik = {
  personnelId: string
  acanUserId: string
  yoneticiId: string
  bilgilendirilenSonYoneticiId: string | null
  durum: TutanakDurum
  sahitler: { personnelId: string; durum: TutanakSahitDurum }[]
}

export type GormeSebebi =
  | 'ACAN'
  | 'SAHIT'
  | 'YONETICI'
  | 'SON_YONETICI'
  | 'IV'
  | 'PLATFORM'
  | 'HAKKINDA_OLAN'
  | 'YOK'

/**
 * Tutanağı görebilir mi (saf). `HAKKINDA_OLAN` izinsizdir ve ÖNCE kontrol edilir:
 * hakkında tutanak tutulan kişi şahit/yönetici olarak atanmış olsa bile görmez.
 */
export function tutanakGorebilir(
  t: TutanakKimlik,
  k: { userId: string; personnelId: string | null; iv: boolean; platformBypass: boolean },
): { izinli: boolean; sebep: GormeSebebi } {
  if (k.personnelId && k.personnelId === t.personnelId) {
    return { izinli: false, sebep: 'HAKKINDA_OLAN' }
  }
  if (t.acanUserId === k.userId) return { izinli: true, sebep: 'ACAN' }
  if (k.iv) return { izinli: true, sebep: 'IV' }
  if (k.personnelId) {
    if (t.sahitler.some((s) => s.personnelId === k.personnelId)) return { izinli: true, sebep: 'SAHIT' }
    if (t.yoneticiId === k.personnelId) return { izinli: true, sebep: 'YONETICI' }
    if (t.bilgilendirilenSonYoneticiId === k.personnelId) return { izinli: true, sebep: 'SON_YONETICI' }
  }
  if (k.platformBypass) return { izinli: true, sebep: 'PLATFORM' }
  return { izinli: false, sebep: 'YOK' }
}

export type OnayKarari = { izinli: boolean; sahip: AdimSahibi }

/**
 * Bu kişi ŞU ANKİ adımın sahibi mi (saf). Platform yöneticisi ve İV burada
 * ayrıcalıklı DEĞİL: İV yalnız IK_BEKLIYOR adımında (tur: 'IV') sahiptir.
 */
export function tutanakOnaylayabilir(
  t: TutanakKimlik,
  k: { userId: string; personnelId: string | null; iv: boolean },
): OnayKarari {
  const sahip = adimSahibi(t)
  switch (sahip.tur) {
    case 'ACAN':
      return { izinli: sahip.userId === k.userId, sahip }
    case 'SAHIT':
      return { izinli: !!k.personnelId && sahip.personnelIdler.includes(k.personnelId), sahip }
    case 'YONETICI':
      return { izinli: !!k.personnelId && sahip.personnelId === k.personnelId, sahip }
    case 'IV':
      return { izinli: k.iv, sahip }
    default:
      return { izinli: false, sahip }
  }
}

export const TUTANAK_ERISIM_YOK = 'Tutanak formuna erişim yetkiniz yok.'
export const TUTANAK_ACMA_YETKISI_YOK =
  'Tutanak yalnız müdür / müdür yardımcısı (kendi bölümü için) ve İnsan Varlıkları tarafından açılabilir.'
export const TUTANAK_ONAY_YETKISI_YOK = 'Bu adımın onayı size ait değil.'

/**
 * Liste sorgusunun `where`'i. İV/platform → hepsi; diğerleri yalnız kendi
 * ilgili olduğu tutanaklar. HER İKİ HÂLDE de "hakkında tutanak tutulan kişi
 * görmez" kuralı uygulanır: kendi personnelId'li kayıtlar dışlanır (İV bile
 * kendi hakkındaki tutanağı listede görmez — fail-closed).
 */
export function tutanakListeWhere(y: {
  userId: string
  personnelId: string | null
  iv: boolean
  platformBypass: boolean
}): import('@/generated/prisma').Prisma.TutanakWhereInput {
  const kendiHaric = y.personnelId ? { personnelId: { not: y.personnelId } } : {}

  if (y.iv || y.platformBypass) return { ...kendiHaric }

  const yollar: import('@/generated/prisma').Prisma.TutanakWhereInput[] = [{ acanUserId: y.userId }]
  if (y.personnelId) {
    yollar.push(
      { sahitler: { some: { personnelId: y.personnelId } } },
      { yoneticiId: y.personnelId },
      { bilgilendirilenSonYoneticiId: y.personnelId },
    )
  }
  return { AND: [{ OR: yollar }, kendiHaric] }
}
