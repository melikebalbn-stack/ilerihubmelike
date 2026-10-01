/**
 * FİF kaynak listesi (FifKaynak, Paket 3) — yetki + doğrulama TEK KAYNAK.
 *
 * Liste KSS veya fif.manage tarafından yönetilir (ekle/düzenle/pasife al —
 * SİLME YOK: geçmiş FİF'lerin kaynağı kaybolmasın). Formda yalnız aktif
 * kaynaklar seçilir. Aynı ad kontrolü Türkçe normalize ile ("Müşteri Şikâyeti"
 * = "MUSTERI SIKAYETI"); DB'deki unique (ad) yalnız birebir aynı yazımı yakalar.
 */
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { normalizeTr } from '@/lib/normalize-tr'
import { canManageFif, isFifKss } from '@/lib/quality/fif-access'

/** Kaynak listesini yönetebilir mi (KSS veya manage). */
export async function fifKaynakYonetebilirMi(session: Session | null | undefined): Promise<boolean> {
  return canManageFif(session) || (await isFifKss(session))
}

/** SAF: `ad` normalize edilince mevcut (başka) bir kaynakla çakışıyor mu. */
export function ayniKaynakAdiVarMi(
  ad: string,
  mevcut: readonly { id: string; ad: string }[],
  haricId?: string,
): boolean {
  const n = normalizeTr(ad.trim())
  return mevcut.some((k) => k.id !== haricId && normalizeTr(k.ad.trim()) === n)
}

/**
 * FİF'e yazılacak kaynakId'yi doğrula: var ve AKTİF olmalı. Hata metni döner;
 * geçerliyse null. (Değişmeyen, sonradan pasife alınmış kaynak için çağırma —
 * eski kayıtların kaydedilmesini engellemesin.)
 */
export async function fifKaynakDogrula(kaynakId: string): Promise<string | null> {
  const k = await prisma.fifKaynak.findUnique({ where: { id: kaynakId }, select: { aktif: true } })
  if (!k) return 'Kaynak bulunamadı'
  if (!k.aktif) return 'Seçilen kaynak pasif — aktif bir kaynak seçin'
  return null
}
