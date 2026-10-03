// Kapasite GÖSTERİM yardımcıları (yalnız biçimlendirme/etiket). SAYILAR kapasite
// motorundan (src/lib/servis-yonetimi/kapasite.ts) gelir; burada koltuk, boş koltuk
// ya da doluluk YENİDEN HESAPLANMAZ.
import type { KapasiteDurumu } from '@/lib/servis-yonetimi/kapasite'

export type KapasiteOzetiGosterim = {
  kapasite: number
  atananPersonelSayisi: number
  bosKoltuk: number
  dolulukOrani: number | null
  aracSayisi: number
  durum: KapasiteDurumu
  asimMiktari: number
}

export const DURUM_ETIKETLERI: Record<KapasiteDurumu, string> = {
  ARAC_YOK: 'Araç yok',
  ASIM: 'Aşım',
  DOLMAK_UZERE: 'Dolmak üzere',
  UYGUN: 'Uygun',
}

export function durumEtiketi(ozet: Pick<KapasiteOzetiGosterim, 'durum' | 'asimMiktari'>): string {
  return ozet.durum === 'ASIM' ? `${DURUM_ETIKETLERI.ASIM} +${ozet.asimMiktari}` : DURUM_ETIKETLERI[ozet.durum]
}

export const TIRE = '—'

/** Araç yoksa koltuk "—" (0 gösterilmez). */
export const koltukMetni = (o: Pick<KapasiteOzetiGosterim, 'durum' | 'kapasite'>): string =>
  o.durum === 'ARAC_YOK' ? TIRE : String(o.kapasite)

/** Araç yoksa boş koltuk "—"; aşımda negatif sayı. */
export const bosKoltukMetni = (o: Pick<KapasiteOzetiGosterim, 'durum' | 'bosKoltuk'>): string =>
  o.durum === 'ARAC_YOK' ? TIRE : String(o.bosKoltuk)

/** Paydasız oran sunulmaz: null → "—". */
export const dolulukMetni = (oran: number | null): string => (oran === null ? TIRE : `%${oran.toFixed(1)}`)

/** Çubuk genişliği (0-100); aşım %100'de kesilir. */
export const dolulukCubugu = (oran: number | null): number => (oran === null ? 0 : Math.max(0, Math.min(100, oran)))
