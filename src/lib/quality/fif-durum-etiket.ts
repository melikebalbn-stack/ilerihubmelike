/**
 * FİF durum etiketleri ve rozet renkleri — TEK KAYNAK.
 *
 * Eskiden aynı harita FifListTable ve FifDurumPanel içinde AYRI AYRI duruyordu;
 * enum'a değer eklenince (FAZ B: KSS adımları) birinde güncelleyip diğerini
 * unutmak boş etiket/renksiz rozet demekti. Record<FifDurum, string> tipi
 * sayesinde yeni bir durum eklenirse DERLEME HATASI verir.
 */
import type { FifDurum } from '@/generated/prisma'

/**
 * Tip notu: harita Record<FifDurum, string> olarak YAZILIR (yeni durum eklenince
 * derleme hatası verir — istenen bekçi), dışa `Record<string, string>` olarak
 * verilir çünkü bileşenler durumu API'den düz string alıyor.
 */
const ETIKET: Record<FifDurum, string> = {
  TASLAK: 'Taslak',
  ONAY_BEKLIYOR: 'Onay Bekliyor',
  KSS_KAYIT_BEKLIYOR: 'KSS Kaydı Bekliyor',
  FAALIYET: 'Faaliyet',
  KAPATMA_BEKLIYOR: 'Kapatma Bekliyor',
  KSS_KAPANIS_BEKLIYOR: 'KSS Kapanış Kontrolü',
  ETKINLIK: 'Etkinlik',
  KAPANDI: 'Kapandı',
  IPTAL: 'İptal',
}

const RENK: Record<FifDurum, string> = {
  TASLAK: 'bg-slate-100 text-slate-700',
  ONAY_BEKLIYOR: 'bg-amber-100 text-amber-800',
  KSS_KAYIT_BEKLIYOR: 'bg-purple-100 text-purple-800',
  FAALIYET: 'bg-blue-100 text-blue-800',
  KAPATMA_BEKLIYOR: 'bg-amber-100 text-amber-800',
  KSS_KAPANIS_BEKLIYOR: 'bg-purple-100 text-purple-800',
  ETKINLIK: 'bg-indigo-100 text-indigo-800',
  KAPANDI: 'bg-green-100 text-green-800',
  IPTAL: 'bg-red-100 text-red-700',
}

export const FIF_DURUM_ETIKET: Record<string, string> = ETIKET
export const FIF_DURUM_RENK: Record<string, string> = RENK

/**
 * FİF'in görünen adı — TEK KAYNAK. Paket 3: numara KSS "Kayda Al"da verilir;
 * öncesinde kayitNo NULL → "Taslak". Liste, detay başlığı, bildirim ve cron
 * başlıkları bunu kullanır (null'ı her yerde ayrı ayrı ele almamak için).
 */
export function fifEtiket(fif: { kayitNo: string | null }): string {
  return fif.kayitNo ?? 'Taslak'
}

/**
 * FifGecmis olay etiketleri (Paket 3b-2) — Geçmiş bölümü. Eski satırlarda olay
 * NULL: "ES:" ile başlayan açıklama eski ek süre kaydıdır, diğerleri durum geçişi.
 */
const OLAY_ETIKET: Record<string, string> = {
  DURUM_DEGISTI: 'Durum değişti',
  FAALIYET_KAPATILDI: 'Faaliyet kapatıldı',
  FAALIYET_YENIDEN_ACILDI: 'Faaliyet yeniden açıldı',
  EK_TERMIN_TALEP: 'Ek termin talebi',
  EK_TERMIN_ONAY: 'Ek termin onaylandı',
  EK_TERMIN_RED: 'Ek termin reddedildi',
  EK_TERMIN_IPTAL: 'Ek termin iptal edildi',
  ETKINLIK_KONTROL: 'Etkinlik kontrolü',
}

export function fifOlayEtiketi(g: { olay: string | null; aciklama: string | null }): string {
  if (g.olay) return OLAY_ETIKET[g.olay] ?? g.olay
  return g.aciklama?.startsWith('ES:') ? 'Ek süre (eski)' : 'Durum değişti'
}
