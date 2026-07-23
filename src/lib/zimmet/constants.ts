/**
 * Zimmet Formu onay akışı sabitleri — Zimmet Teslim Formu modülü.
 *
 * Onaylayan tek kişi (Melih Dilben) — env değişkeni yerine sabit const:
 * sandbox'a özel, tek değer, ortam başına değişmiyor. DB'de doğrulandı
 * (id "ad_" önekiyle LDAP/AD kaynaklı kullanıcıyı işaret ediyor).
 */

export const APPROVER_USER_ID = 'ad_melih.dilben'
export const APPROVER_EMAIL = 'melih.dilben@ilerigroup.com'
export const APPROVER_NAME = 'Melih Dilben'

export function getZimmetDurumRozeti(zimmet: {
  durum: string
  imzaModu: string | null
  zimmetSahibiImzaTarihi: Date | string | null
  islakImzaDosyasi: string | null
}) {
  if (zimmet.durum === 'ONAY_BEKLIYOR') return { label: 'Onay Bekliyor', renk: 'gri' } as const
  if (zimmet.durum === 'REDDEDILDI') return { label: 'Reddedildi', renk: 'kirmizi' } as const

  if (zimmet.imzaModu === 'ISLAK') {
    if (!zimmet.islakImzaDosyasi) {
      return { label: 'Belge Yüklenmesi Gerekmektedir', renk: 'amber' } as const
    }
    return { label: 'Tamamlandı', renk: 'yesil' } as const
  }

  if (!zimmet.zimmetSahibiImzaTarihi) {
    return { label: 'İmza Bekleniyor', renk: 'amber' } as const
  }
  return { label: 'Tamamlandı', renk: 'yesil' } as const
}

export type ZimmetDurumRozeti = ReturnType<typeof getZimmetDurumRozeti>
