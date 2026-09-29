/**
 * İzin Faz 6 — onay hatırlatması kuralları, SAF (DB yok, birim testli). Servis: hatirlatma.ts.
 *
 * - Eskalasyon YOK; yalnız hatırlatma. Talep bir kademeye (YONETICI / IV) düştükten `saat` (izin_hatirlatma_saat,
 *   varsayılan 24) saat sonra o kademeye BİR KEZ mail. Kademe değişince (YONETICI → IV) yeni sayaç.
 * - Gönderim penceresi: iş günü (Pzt–Cum, IproTatil TATIL değil; arefe YARIM iş günü sayılır) ve yerel saat
 *   ≥ 08:30. Süre hafta sonu / tatil / gece dolduysa bir sonraki iş günü 08:30'dan sonraki ilk çalışmada gider.
 * - Kademeye düşüş anı: BEKLIYOR_YONETICI → talebin oluşturulması; BEKLIYOR_IV → yönetici kademesinin son
 *   ONAY/ATLANDI izi (yoksa — doğrudan İV'ye giden talep — oluşturulma).
 */

export type HatirlatmaKademesi = 'YONETICI' | 'IV'

export const HATIRLATMA_SAAT_AYARI = 'izin_hatirlatma_saat'
export const HATIRLATMA_SAAT_VARSAYILAN = 24
/** Yerel (Europe/Istanbul, +03:00 sabit) gönderim başlangıcı, gün içi dakika: 08:30 */
export const GONDERIM_BASLANGIC_DK = 8 * 60 + 30

const OFSET_MS = 3 * 3600_000

/** UTC Date → yerel gün "YYYY-MM-DD" + gün içi dakika */
export function yerelZaman(simdi: Date): { gun: string; dakika: number; haftaGunu: number } {
  const y = new Date(simdi.getTime() + OFSET_MS)
  return { gun: y.toISOString().slice(0, 10), dakika: y.getUTCHours() * 60 + y.getUTCMinutes(), haftaGunu: y.getUTCDay() }
}

/** Gönderim penceresi açık mı: iş günü + 08:30 sonrası. `tatilTipi`: o günün IproTatil tipi (yoksa null). */
export function gonderimPenceresi(simdi: Date, tatilTipi: string | null): { acik: true } | { acik: false; sebep: string } {
  const z = yerelZaman(simdi)
  if (z.haftaGunu === 0 || z.haftaGunu === 6) return { acik: false, sebep: 'hafta sonu' }
  if (tatilTipi === 'TATIL') return { acik: false, sebep: 'resmi tatil' }
  if (z.dakika < GONDERIM_BASLANGIC_DK) return { acik: false, sebep: '08:30 öncesi' }
  return { acik: true }
}

/** Ayar değeri → saat (pozitif tam sayı; değilse varsayılan). */
export function hatirlatmaSaati(deger: string | null | undefined): number {
  const n = Number(deger?.trim())
  return Number.isInteger(n) && n > 0 ? n : HATIRLATMA_SAAT_VARSAYILAN
}

/** Süre doldu mu: düşüşten tam `saat` saat geçtiyse (sınır dahil). */
export const vadeDolduMu = (dusus: Date, simdi: Date, saat: number) => simdi.getTime() - dusus.getTime() >= saat * 3600_000

export interface KademeGirdisi {
  durum: string
  createdAt: Date
  onaylar: { kademe: string; karar: string; createdAt: Date }[]
}

/** Talebin şu an beklediği kademe ve o kademeye düştüğü an; bekleyen değilse null. */
export function kademeDususu(t: KademeGirdisi): { kademe: HatirlatmaKademesi; dusus: Date } | null {
  if (t.durum === 'BEKLIYOR_YONETICI') return { kademe: 'YONETICI', dusus: t.createdAt }
  if (t.durum !== 'BEKLIYOR_IV') return null
  const izler = t.onaylar.filter((o) => o.kademe === 'YONETICI' && (o.karar === 'ONAY' || o.karar === 'ATLANDI'))
  const son = izler.reduce<Date | null>((m, o) => (!m || o.createdAt > m ? o.createdAt : m), null)
  return { kademe: 'IV', dusus: son ?? t.createdAt }
}

export const talepAnahtari = (talepId: string, kademe: HatirlatmaKademesi) => `TALEP:${talepId}:${kademe}`
export const erkenDonusAnahtari = (erkenDonusId: string) => `ERKEN:${erkenDonusId}`
