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
import { isCalismaGunu, duvarSaati, duvardanAn, type SlaCalismaAyari } from '@/lib/sla/calisma-takvimi'

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

/** Kök neden analizi süresi (iş günü) — "Onaya Gönder"den itibaren. */
export const FIF_KOK_NEDEN_IS_GUNU = 5

/**
 * Kök neden analizi son günü: baslangic'tan sonraki N'inci İŞ GÜNÜ (baslangic
 * günü HARİÇ — isGunuSayisi ile aynı sayım, aynı SLA takvimi). Gün İstanbul
 * saatine göre alınır (gece 00:00–03:00 gönderimi önceki UTC gününe kaymasın).
 * `gecikti`: şu an son günün İstanbul 23:59'unu geçti mi.
 */
export function kokNedenSonTarihi(
  baslangic: Date,
  tatilMap: Map<string, IproTatilTip>,
  ayar: SlaCalismaAyari,
  simdi: Date,
  isGunu: number = FIF_KOK_NEDEN_IS_GUNU,
): { sonGun: Date; gecikti: boolean } {
  const d = duvarSaati(baslangic)
  const imlec = new Date(Date.UTC(d.yil, d.ay - 1, d.gun, 12))
  let sayi = 0
  for (let i = 0; i < AZAMI_TAKVIM_GUNU && sayi < isGunu; i++) {
    imlec.setUTCDate(imlec.getUTCDate() + 1)
    if (isCalismaGunu(imlec, tatilMap, ayar)) sayi++
  }
  const gunSonu = duvardanAn(imlec.getUTCFullYear(), imlec.getUTCMonth() + 1, imlec.getUTCDate(), 23, 59)
  return { sonGun: imlec, gecikti: simdi.getTime() > gunSonu.getTime() }
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

/**
 * Bildirim başlığı — tekrar gönderim (dedup) anahtarı da bu: seviye + gecikmeyi
 * belirleyen HEDEF TARİH. Ek termin onayıyla hedef değişince anahtar değişir,
 * yeni hedef de kaçırılırsa seviyeler (1 → 2 → 3) baştan başlar.
 */
export function eskalasyonKonusu(fifEtiketi: string, seviye: FifEskalasyonSeviyesi, hedefTarih: string): string {
  return `[FİF ${fifEtiketi}] Eskalasyon ${seviye} — faaliyet gecikmesi (hedef ${hedefTarih})`
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

/**
 * Paket 4 — KÖK NEDEN / FAALİYET PLANI eskalasyonu (5 iş günü): KSS yönlendirmesinden
 * (SORUMLU_ATAMA_BEKLIYOR'a İLK giriş) itibaren 5 iş günü dolmuş VE (kök neden boş
 * VEYA hiç faaliyet satırı yok) ise. Başlangıcı olmayan (bu adımdan önce yönlendirilmiş)
 * kayıt eskale edilmez. Sayım kokNedenSonTarihi ile — ekrandaki uyarıyla AYNI kural.
 */
export function kokNedenEskalasyonuGerekli(g: {
  baslangic: Date | null
  kokNedenDolu: boolean
  faaliyetSayisi: number
  tatilMap: Map<string, IproTatilTip>
  ayar: SlaCalismaAyari
  simdi: Date
}): { gerekli: boolean; sonGun: Date | null } {
  if (!g.baslangic) return { gerekli: false, sonGun: null }
  if (g.kokNedenDolu && g.faaliyetSayisi > 0) return { gerekli: false, sonGun: null }
  const s = kokNedenSonTarihi(g.baslangic, g.tatilMap, g.ayar, g.simdi)
  return { gerekli: s.gecikti, sonGun: s.sonGun }
}

/** Kök neden eskalasyonu başlığı — FİF başına TEK gönderimin dedup anahtarı. */
export function kokNedenEskalasyonKonusu(fifEtiketi: string): string {
  return `[FİF ${fifEtiketi}] Eskalasyon — kök neden / faaliyet planı ${FIF_KOK_NEDEN_IS_GUNU} iş gününde tamamlanmadı`
}

export function kokNedenEskalasyonGovdesi(g: { kokNedenDolu: boolean; faaliyetSayisi: number; sonGun: Date }): string {
  const eksik = [!g.kokNedenDolu ? 'kök neden analizi' : null, g.faaliyetSayisi === 0 ? 'faaliyet planı' : null]
    .filter(Boolean)
    .join(' ve ')
  const son = g.sonGun.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
  return (
    `KSS yönlendirmesinden itibaren ${FIF_KOK_NEDEN_IS_GUNU} iş günü doldu (son gün ${son}); ${eksik} henüz girilmedi.\n` +
    'Sorumlu bölüm müdürü, izleme sorumlusu (atanmışsa) ve KSS bilgilendirildi.'
  )
}
