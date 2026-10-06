import { randomUUID } from 'node:crypto'
import { IsapiHata, cihazSaatiAl, isapiIstek, type IsapiCihaz } from './isapi-istemci'
import {
  KAYIP_BOSLUK_SAAT,
  SAAT_SAPMA_ESIGI_SN,
  acsEventCoz,
  hikZamanOfsetli,
  imleciIlerlet,
  olaylariIsle,
  type CihazDurumu,
  type HamOlay,
  type ImlecSonucu,
  type IslemOzeti,
  type OlayDeposu,
} from './olay-alim'
import type { OlayEsleme } from './olay-esleme'

/**
 * PDKS Faz 3 — AcsEvent boşluk doldurma turu (plan §3.1). Push birincil; bu tur dakikada bir
 * (/api/cron/pdks-olay-toplayici) panelin kendi olay günlüğünü okur ve push'un kaçırdıklarını yazar.
 *
 * Pencere: kesintisiz alınan son olayın (imleç) zamanından ÖRTÜŞME_DK önce → şimdi + 1 dk.
 * İmleç yoksa (ilk kurulum) son KAYIP_BOSLUK_SAAT saat. Sayfa başına 30 olay, tur başına en fazla
 * MAKS_SAYFA sayfa — kalan bir sonraki turda (imleç ilerlediği için pencere kayar).
 * Panel saati SAAT_KONTROL_DK'da bir /ISAPI/System/time ile ölçülür.
 */
export const ORTUSME_DK = 10
export const MAKS_SAYFA = 50
export const SAAT_KONTROL_DK = 10

export type ToplayiciCihazi = CihazDurumu & IsapiCihaz & { saatKontrolAt: Date | null }

export async function acsEventCek(
  cihaz: IsapiCihaz,
  baslangic: Date,
  bitis: Date,
  maksSayfa = MAKS_SAYFA,
): Promise<{ olaylar: HamOlay[]; sayfa: number; tamam: boolean; atlanan: number }> {
  const searchID = randomUUID().replace(/-/g, '') // ISAPI searchID ≤32 char (UUID tireli 36)
  const olaylar: HamOlay[] = []
  let atlanan = 0
  for (let sayfa = 1; sayfa <= maksSayfa; sayfa++) {
    const y = await isapiIstek(cihaz, '/ISAPI/AccessControl/AcsEvent?format=json', {
      method: 'POST',
      json: {
        AcsEventCond: {
          searchID,
          searchResultPosition: olaylar.length + atlanan,
          maxResults: 5,
          major: 0,
          minor: 0,
          startTime: hikZamanOfsetli(baslangic),
          endTime: hikZamanOfsetli(bitis),
        },
      },
    })
    let veri: Record<string, unknown>
    try {
      veri = JSON.parse(y.metin) as Record<string, unknown>
    } catch {
      throw new IsapiHata('GECERSIZ_YANIT', 'AcsEvent: JSON olmayan yanıt')
    }
    const c = acsEventCoz(veri)
    olaylar.push(...c.olaylar)
    atlanan += c.atlanan
    if (!c.devam) return { olaylar, sayfa, tamam: true, atlanan }
  }
  return { olaylar, sayfa: maksSayfa, tamam: false, atlanan }
}

export interface ToplayiciOzeti {
  cihaz: string
  pencere: { baslangic: string; bitis: string }
  sayfa: number
  pencereTamam: boolean
  islem: IslemOzeti
  imlec: ImlecSonucu
  saatSapmaSn: number | null
  uyarilar: string[]
}

export async function toplayiciTuru(
  depo: OlayDeposu,
  cihaz: ToplayiciCihazi,
  esleme: OlayEsleme,
  simdi = new Date(),
): Promise<ToplayiciOzeti> {
  const uyarilar: string[] = []
  let saatSapmaSn: number | null = null

  // 1. Panel saati (10 dk'da bir). Hata turu DURDURMAZ — olay toplama daha önemli.
  if (!cihaz.saatKontrolAt || simdi.getTime() - cihaz.saatKontrolAt.getTime() >= SAAT_KONTROL_DK * 60_000) {
    try {
      const s = await cihazSaatiAl(cihaz)
      saatSapmaSn = s.sapmaSn
      await depo.cihazGuncelle(cihaz.id, { saatSapmaSn: s.sapmaSn, saatKontrolAt: simdi })
      if (Math.abs(s.sapmaSn) > SAAT_SAPMA_ESIGI_SN) {
        uyarilar.push(`${cihaz.kod}: panel saati sapması ${s.sapmaSn} sn (eşik ±${SAAT_SAPMA_ESIGI_SN}) — NTP'yi kontrol edin`)
      }
    } catch (e) {
      if (!(e instanceof IsapiHata)) throw e
      uyarilar.push(`${cihaz.kod}: saat ölçülemedi (${e.kod})`)
    }
  }

  // 2. Pencere — imlecin zamanından örtüşmeli.
  const imlecZamani = cihaz.sonSeriNo !== null ? await depo.seriZamani(cihaz.id, cihaz.seriDonem, cihaz.sonSeriNo) : null
  const baslangic = new Date((imlecZamani?.getTime() ?? simdi.getTime() - KAYIP_BOSLUK_SAAT * 3600_000) - ORTUSME_DK * 60_000)
  const bitis = new Date(simdi.getTime() + 60_000)

  // 3. Çek → işle → imleç
  const cek = await acsEventCek(cihaz, baslangic, bitis)
  if (cek.atlanan) uyarilar.push(`${cihaz.kod}: ${cek.atlanan} AcsEvent kaydı ayrıştırılamadı`)
  if (!cek.tamam) uyarilar.push(`${cihaz.kod}: pencere ${MAKS_SAYFA} sayfada bitmedi — sonraki turda sürecek`)
  const islem = await olaylariIsle(depo, cihaz, cek.olaylar, { kaynak: 'POLL', esleme, simdi })
  const imlec = await imleciIlerlet(depo, cihaz, simdi)
  await depo.cihazGuncelle(cihaz.id, { sonPollAt: simdi, sonGorulmeAt: simdi })

  for (const k of imlec.kayiplar) {
    uyarilar.push(`${cihaz.kod}: KAYIP BOŞLUK seri ${k.seriBaslangic}-${k.seriBitis} (${k.kayipAdet} olay) — imleç ilerletildi`)
  }
  return {
    cihaz: cihaz.kod,
    pencere: { baslangic: baslangic.toISOString(), bitis: bitis.toISOString() },
    sayfa: cek.sayfa,
    pencereTamam: cek.tamam,
    islem,
    imlec,
    saatSapmaSn,
    uyarilar: [...uyarilar, ...islem.uyarilar],
  }
}
