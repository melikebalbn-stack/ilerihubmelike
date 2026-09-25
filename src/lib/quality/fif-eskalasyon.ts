/**
 * FİF (KAL-FR-10) eskalasyon kuralı — SAF çekirdek (DB'siz test edilebilir).
 *
 * KURAL (Melih kararı 25.09.2026): faaliyet aşamasındaki bir FİF'te hedef tarih
 * geçtikten sonra her 5 İŞ GÜNÜNDE bir kademe yükselir:
 *   Seviye 1 (5 iş günü)  → sorumlu bölüm müdürü + KSS
 *   Seviye 2 (10 iş günü) → bölümün org ağacındaki ilk GMY/GM koltuğu
 *   Seviye 3 (15 iş günü) → Genel Müdür
 * Seviye başına TEK bildirim (dedup: in-app başlığı seviye taşır).
 *
 * İŞ GÜNÜ KAYNAĞI: SLA çalışma takvimi (`src/lib/sla`) — tatil/yarım gün/cumartesi
 * kuralları ORADAN gelir, burada yeni takvim kodu YOK. Ayar değişirse (mesai
 * saatleri/tatiller) FİF eşiği de aynı takvime göre kayar — bilinçli tercih.
 */
import type { IproTatilTip } from '@/lib/ipro/takvim-util'
import { isCalismaGunu, type SlaCalismaAyari } from '@/lib/sla/calisma-takvimi'

/** Seviye eşikleri (iş günü). Sıra ARTAN olmalı. */
export const FIF_ESKALASYON_ESIKLERI = [5, 10, 15] as const
export type FifEskalasyonSeviyesi = 1 | 2 | 3

/** Döngü guard'ı: iki tarih arası en fazla bu kadar takvim günü taranır. */
const AZAMI_TAKVIM_GUNU = 400

/**
 * İki tarih arasındaki İŞ GÜNÜ sayısı (baslangic günü HARİÇ, bitis günü DAHİL).
 * Gün/tatil kararı `isCalismaGunu` ile SLA takviminden gelir.
 */
export function isGunuSayisi(
  baslangic: Date,
  bitis: Date,
  tatilMap: Map<string, IproTatilTip>,
  ayar: SlaCalismaAyari,
): number {
  if (bitis.getTime() <= baslangic.getTime()) return 0
  let sayi = 0
  // Gün gün ilerle — UTC 12:00 çapası ile yaz saati/gün kayması sorunu olmaz
  // (calisma-takvimi.duvarSaati Istanbul'a çevirir).
  const imlec = new Date(Date.UTC(baslangic.getUTCFullYear(), baslangic.getUTCMonth(), baslangic.getUTCDate(), 12))
  const son = new Date(Date.UTC(bitis.getUTCFullYear(), bitis.getUTCMonth(), bitis.getUTCDate(), 12))
  for (let i = 0; i < AZAMI_TAKVIM_GUNU; i++) {
    imlec.setUTCDate(imlec.getUTCDate() + 1)
    if (imlec.getTime() > son.getTime()) break
    if (isCalismaGunu(imlec, tatilMap, ayar)) sayi++
  }
  return sayi
}

/**
 * Gecikmeye göre seviye. Eşiğin altındaysa null (eskalasyon YOK).
 * En yüksek aşılan eşik kazanır → gecikme 12 iş günüyse seviye 2'dedir
 * (1 ve 2 birlikte gönderilmez; 1 zaten daha önce gönderilmişti).
 */
export function eskalasyonSeviyesi(gecikmeIsGunu: number): FifEskalasyonSeviyesi | null {
  let seviye: FifEskalasyonSeviyesi | null = null
  FIF_ESKALASYON_ESIKLERI.forEach((esik, i) => {
    if (gecikmeIsGunu >= esik) seviye = (i + 1) as FifEskalasyonSeviyesi
  })
  return seviye
}

/** Bildirim başlığı — dedup anahtarı da bu (seviye başına tek mail). */
export function eskalasyonKonusu(kayitNo: string, seviye: FifEskalasyonSeviyesi): string {
  return `[FİF ${kayitNo}] Eskalasyon ${seviye} — faaliyet gecikmesi`
}

/** Seviye açıklaması (mail gövdesi). */
export function eskalasyonGovdesi(seviye: FifEskalasyonSeviyesi, gecikmeIsGunu: number, hedefTarih: string): string {
  const kim =
    seviye === 1
      ? 'Sorumlu bölüm müdürü ve Kalite Sistem Sorumlusu bilgilendirildi.'
      : seviye === 2
        ? 'Üst yönetim (bağlı olduğu GMY/GM koltuğu) bilgilendirildi.'
        : 'Genel Müdür bilgilendirildi.'
  return (
    `Faaliyet hedef tarihi ${hedefTarih} olan FİF, ${gecikmeIsGunu} iş günü gecikmede.\n` +
    `Eskalasyon seviyesi: ${seviye}. ${kim}`
  )
}
