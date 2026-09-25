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
