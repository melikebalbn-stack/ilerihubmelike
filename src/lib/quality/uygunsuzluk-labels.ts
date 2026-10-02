/**
 * Kalite uygunsuzluk (KAL-KYT-15 Bölüm 2) — ortak etiket sabitleri.
 * TEK KAYNAK; ekranlar buradan okur (rma-labels.ts deseni).
 */
import { UygunsuzlukKarar } from '@/generated/prisma'

export const UYGUNSUZLUK_KARAR_LABELS: Record<UygunsuzlukKarar, string> = {
  HURDA: 'Hurda',
  IADE: 'İade',
  TAMIR: 'Tamir',
}

/** Seçici/dropdown için {value,label} dizisi. */
export const UYGUNSUZLUK_KARAR_OPTIONS = (
  Object.keys(UYGUNSUZLUK_KARAR_LABELS) as UygunsuzlukKarar[]
).map((k) => ({ value: k, label: UYGUNSUZLUK_KARAR_LABELS[k] }))

/**
 * Red oranı — TEK KAYNAK hesap. Şemada alan YOK, kasıtlı.
 *
 * `isEmriAdeti` boş ya da 0 ise **null** döner: "#DIV/0!" ya da yanıltıcı "0%"
 * gösterilmez, çağıran hiçbir şey basmaz.
 */
export function redOrani(toplamRedAdeti: number, isEmriAdeti: number | null | undefined): number | null {
  if (!isEmriAdeti || isEmriAdeti <= 0) return null
  return (toplamRedAdeti / isEmriAdeti) * 100
}

/** Yüzde biçimi — tek ondalık, TR ayraç. null → '—' değil, çağıran karar verir. */
export function formatOran(oran: number): string {
  return `%${oran.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
}

export type UygunsuzlukDurum = 'ACIK' | 'DEVAM_EDIYOR' | 'KAPALI'

export const UYGUNSUZLUK_DURUM_LABELS: Record<UygunsuzlukDurum, string> = {
  ACIK: 'Açık',
  DEVAM_EDIYOR: 'Devam Ediyor',
  KAPALI: 'Kapalı',
}

/**
 * Durum — TEK KAYNAK hesap. Şemada alan YOK, kasıtlı (redOrani ile aynı mantık).
 * KAPALI: kapanış tarihi girilmiş. DEVAM EDİYOR: kapanmamış ama ilerleme verisi
 * (kök neden/aksiyon/sorumlu/onaylayan/termin) girilmiş. ACIK: hiçbiri.
 */
export function hesaplaDurum(k: {
  kapanisTarihi: Date | string | null
  kokNeden?: string | null
  kacisKokNedeni?: string | null
  duzelticiFaaliyet?: string | null
  geciciAksiyon?: string | null
  sorumluId?: string | null
  onaylayanId?: string | null
  termin?: Date | string | null
}): UygunsuzlukDurum {
  if (k.kapanisTarihi) return 'KAPALI'
  const ilerlemeVar = Boolean(
    k.kokNeden || k.kacisKokNedeni || k.duzelticiFaaliyet || k.geciciAksiyon ||
    k.sorumluId || k.onaylayanId || k.termin,
  )
  return ilerlemeVar ? 'DEVAM_EDIYOR' : 'ACIK'
}
