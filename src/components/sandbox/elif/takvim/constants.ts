import {
  AlertTriangle, BadgeCheck, CalendarClock, CheckCircle2, Clock, FileText,
  Hourglass, PauseCircle, RefreshCw, RotateCcw, XCircle, type LucideIcon,
} from 'lucide-react'
import type {
  YillikTakvimDurum,
  YillikTakvimGerceklesmeDurumu,
  YillikTakvimOncelik,
  YillikTakvimPeriyot,
} from './types'

type DurumMeta = { label: string; colorClass: string; Icon: LucideIcon }

export const DURUM_META: Record<YillikTakvimDurum, DurumMeta> = {
  TASLAK: { label: 'Taslak', colorClass: 'bg-slate-100 text-slate-700 border-slate-200', Icon: FileText },
  PLANLANDI: { label: 'Planlandı', colorClass: 'bg-blue-100 text-blue-800 border-blue-200', Icon: CalendarClock },
  DEVAM_EDIYOR: { label: 'Devam Ediyor', colorClass: 'bg-blue-100 text-blue-800 border-blue-200', Icon: RefreshCw },
  YAKLASIYOR: { label: 'Yaklaşıyor', colorClass: 'bg-orange-100 text-orange-800 border-orange-200', Icon: Clock },
  GECIKTI: { label: 'Gecikti', colorClass: 'bg-red-100 text-red-800 border-red-200', Icon: AlertTriangle },
  TAMAMLANDI: { label: 'Tamamlandı', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  TAMAMLANDI_ONAY_BEKLIYOR: { label: 'Onay Bekliyor', colorClass: 'bg-orange-100 text-orange-800 border-orange-200', Icon: Hourglass },
  ONAYLANDI: { label: 'Onaylandı', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200', Icon: BadgeCheck },
  REVIZYON_ISTENDI: { label: 'Revizyon İstendi', colorClass: 'bg-purple-100 text-purple-800 border-purple-200', Icon: RotateCcw },
  ERTELENDI: { label: 'Ertelendi', colorClass: 'bg-slate-100 text-slate-700 border-slate-200', Icon: PauseCircle },
  IPTAL_EDILDI: { label: 'İptal Edildi', colorClass: 'bg-slate-100 text-slate-500 border-slate-200', Icon: XCircle },
  ASKIYA_ALINDI: { label: 'Askıya Alındı', colorClass: 'bg-slate-100 text-slate-700 border-slate-200', Icon: PauseCircle },
}

export const ONCELIK_META: Record<YillikTakvimOncelik, { label: string; colorClass: string }> = {
  DUSUK: { label: 'Düşük', colorClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  ORTA: { label: 'Orta', colorClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  YUKSEK: { label: 'Yüksek', colorClass: 'bg-orange-100 text-orange-800 border-orange-200' },
  KRITIK: { label: 'Kritik', colorClass: 'bg-red-100 text-red-800 border-red-200' },
}

export const PERIYOT_META: Record<YillikTakvimPeriyot, { label: string }> = {
  TEK_SEFERLIK: { label: 'Tek Seferlik' }, GUNLUK: { label: 'Günlük' },
  HAFTALIK: { label: 'Haftalık' }, IKI_HAFTADA_BIR: { label: 'İki Haftada Bir' },
  AYLIK: { label: 'Aylık' }, IKI_AYDA_BIR: { label: 'İki Ayda Bir' },
  UC_AYLIK: { label: 'Üç Aylık' }, ALTI_AYLIK: { label: 'Altı Aylık' },
  YILLIK: { label: 'Yıllık' }, IKI_YILDA_BIR: { label: 'İki Yılda Bir' },
  UC_YILDA_BIR: { label: 'Üç Yılda Bir' }, BELIRLI_AYLAR: { label: 'Belirli Aylar' },
  BELIRLI_TARIHLER: { label: 'Belirli Tarihler' }, OZEL: { label: 'Özel' },
}

export const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const KALAN_GUN_ANLAMSIZ_DURUMLAR: YillikTakvimDurum[] = ['IPTAL_EDILDI', 'ONAYLANDI', 'TAMAMLANDI', 'TAMAMLANDI_ONAY_BEKLIYOR']
export function kalanGunGosterilsinMi(durum: YillikTakvimDurum): boolean {
  return !KALAN_GUN_ANLAMSIZ_DURUMLAR.includes(durum)
}

export const GERCEKLESME_META: Record<YillikTakvimGerceklesmeDurumu, { label: string; colorClass: string }> = {
  BEKLIYOR: { label: 'Bekliyor', colorClass: 'bg-slate-100 text-slate-600 border-slate-200' },
  GERCEKLESTI: { label: 'Gerçekleşti', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  GERCEKLESMEDI: { label: 'Gerçekleşmedi', colorClass: 'bg-red-100 text-red-800 border-red-200' },
  DEVREDILDI: { label: 'Devredildi', colorClass: 'bg-purple-100 text-purple-800 border-purple-200' },
  PLANDISI: { label: 'Plan Dışı', colorClass: 'bg-orange-100 text-orange-800 border-orange-200' },
}

export const DURUM_NOKTA_RENK: Record<YillikTakvimDurum, string> = {
  TASLAK: 'bg-slate-400', PLANLANDI: 'bg-blue-500', DEVAM_EDIYOR: 'bg-blue-500',
  YAKLASIYOR: 'bg-orange-500', GECIKTI: 'bg-red-500', TAMAMLANDI: 'bg-emerald-500',
  TAMAMLANDI_ONAY_BEKLIYOR: 'bg-orange-500', ONAYLANDI: 'bg-emerald-500',
  REVIZYON_ISTENDI: 'bg-purple-500', ERTELENDI: 'bg-slate-400',
  IPTAL_EDILDI: 'bg-slate-300', ASKIYA_ALINDI: 'bg-slate-400',
}
