/**
 * IV-FR-03 Tutanak Formu — AKIŞ MOTORU (saf, DB'ye gitmez).
 *
 * TASLAK → SAHIT_BEKLIYOR → YONETICI_BEKLIYOR → IK_BEKLIYOR → TAMAMLANDI
 *                     └──────────── herhangi bir ret ───────────→ REDDEDILDI
 *
 * Geçiş matrisi DENY-BY-DEFAULT (deneme zinciri DENEME_GECISLERI deseni):
 * listede olmayan geçiş reddedilir. Böylece yeni bir aksiyon eklendiğinde
 * matrise yazılmadıkça hiçbir yoldan durum değiştiremez.
 */

import type { TutanakDurum, TutanakSahitDurum } from '@/generated/prisma'

export type TutanakAksiyon =
  | 'GONDER' // oluşturan: TASLAK → SAHIT_BEKLIYOR
  | 'SAHIT_ONAY'
  | 'SAHIT_RET'
  | 'YONETICI_ONAY'
  | 'YONETICI_RET'
  | 'IV_KAPAT'

/** Aksiyonun yürütülebildiği durum(lar). Matriste olmayan çift = YASAK. */
const GECISLER: Record<TutanakAksiyon, TutanakDurum[]> = {
  GONDER: ['TASLAK'],
  SAHIT_ONAY: ['SAHIT_BEKLIYOR'],
  SAHIT_RET: ['SAHIT_BEKLIYOR'],
  YONETICI_ONAY: ['YONETICI_BEKLIYOR'],
  YONETICI_RET: ['YONETICI_BEKLIYOR'],
  IV_KAPAT: ['IK_BEKLIYOR'],
}

export const GECIS_YASAK_HATASI = 'Bu işlem tutanağın şu anki durumunda yapılamaz.'

export function aksiyonUygunMu(durum: TutanakDurum, aksiyon: TutanakAksiyon): boolean {
  return GECISLER[aksiyon]?.includes(durum) ?? false
}

/** Tüm şahitler onayladı mı? Şahitsiz liste FALSE döner (en az 1 şahit şart). */
export function sahitlerTamamlandiMi(sahitDurumlari: TutanakSahitDurum[]): boolean {
  return sahitDurumlari.length > 0 && sahitDurumlari.every((d) => d === 'ONAYLADI')
}

export function sahitRedVarMi(sahitDurumlari: TutanakSahitDurum[]): boolean {
  return sahitDurumlari.some((d) => d === 'REDDETTI')
}

/**
 * Bir şahit karar verdikten SONRA tutanağın durumu.
 * · ret        → REDDEDILDI (tek ret yeter; kalan şahitler beklenmez)
 * · hepsi onay → YONETICI_BEKLIYOR
 * · eksik onay → SAHIT_BEKLIYOR (değişmez, paralel bekleme sürer)
 *
 * `sahitDurumlari` KARARIN YAZILDIKTAN SONRAKİ hâli olmalıdır.
 */
export function sahitKarariSonrasiDurum(sahitDurumlari: TutanakSahitDurum[]): TutanakDurum {
  if (sahitRedVarMi(sahitDurumlari)) return 'REDDEDILDI'
  return sahitlerTamamlandiMi(sahitDurumlari) ? 'YONETICI_BEKLIYOR' : 'SAHIT_BEKLIYOR'
}

/** Aksiyonun hedef durumu. Şahit kararında kalan şahitlere bakılması gerekir. */
export function hedefDurum(
  aksiyon: Exclude<TutanakAksiyon, 'SAHIT_ONAY' | 'SAHIT_RET'>,
): TutanakDurum {
  switch (aksiyon) {
    case 'GONDER':
      return 'SAHIT_BEKLIYOR'
    case 'YONETICI_ONAY':
      return 'IK_BEKLIYOR'
    case 'YONETICI_RET':
      return 'REDDEDILDI'
    case 'IV_KAPAT':
      return 'TAMAMLANDI'
  }
}

/** Akış bitti mi — bitmiş tutanakta hiçbir aksiyon çalışmaz. */
export function kapaliMi(durum: TutanakDurum): boolean {
  return durum === 'TAMAMLANDI' || durum === 'REDDEDILDI'
}

/**
 * ADIM SAHİBİ: o anda kimden işlem bekleniyor.
 * Onay yetkisi bu fonksiyonla belirlenir; platform yöneticisi bypass'ı YOKTUR
 * (§3 kararı: platform kuralı yalnız GÖRÜNTÜLEME açar, onay zincirine karışmaz).
 */
export type AdimSahibi =
  | { tur: 'ACAN'; userId: string }
  | { tur: 'SAHIT'; personnelIdler: string[] }
  | { tur: 'YONETICI'; personnelId: string }
  | { tur: 'IV' }
  | { tur: 'YOK' }

export function adimSahibi(t: {
  durum: TutanakDurum
  acanUserId: string
  yoneticiId: string
  sahitler: { personnelId: string; durum: TutanakSahitDurum }[]
}): AdimSahibi {
  switch (t.durum) {
    case 'TASLAK':
      return { tur: 'ACAN', userId: t.acanUserId }
    case 'SAHIT_BEKLIYOR':
      return {
        tur: 'SAHIT',
        personnelIdler: t.sahitler.filter((s) => s.durum === 'BEKLIYOR').map((s) => s.personnelId),
      }
    case 'YONETICI_BEKLIYOR':
      return { tur: 'YONETICI', personnelId: t.yoneticiId }
    case 'IK_BEKLIYOR':
      return { tur: 'IV' }
    default:
      return { tur: 'YOK' }
  }
}

export const DURUM_ETIKETLERI: Record<TutanakDurum, string> = {
  TASLAK: 'Taslak',
  SAHIT_BEKLIYOR: 'Şahit Onayı Bekliyor',
  YONETICI_BEKLIYOR: 'Yönetici Onayı Bekliyor',
  IK_BEKLIYOR: 'İnsan Varlıkları Bekliyor',
  TAMAMLANDI: 'Tamamlandı',
  REDDEDILDI: 'Reddedildi',
}

export const SEBEP_ETIKETLERI = {
  ISG_KURALLARINA_UYMAMA: 'İSG Kurallarına Uymama',
  DISIPLIN: 'Disiplin',
  HATALI_ISLEM_URETIM: 'Hatalı İşlem / Üretim',
  DEVAMSIZLIK: 'Devamsızlık',
} as const

export const SAHIT_DURUM_ETIKETLERI: Record<TutanakSahitDurum, string> = {
  BEKLIYOR: 'Bekliyor',
  ONAYLADI: 'Onayladı',
  REDDETTI: 'Reddetti',
}
