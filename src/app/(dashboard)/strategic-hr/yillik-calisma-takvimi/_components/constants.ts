import type { YillikTakvimDurum, YillikTakvimOncelik, YillikTakvimPeriyot } from '@/generated/prisma'

export const DURUM_META: Record<YillikTakvimDurum, { label: string; className: string; dot: string }> = {
  TASLAK: { label: 'Taslak', className: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  PLANLANDI: { label: 'Planlandı', className: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  DEVAM_EDIYOR: { label: 'Devam Ediyor', className: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  YAKLASIYOR: { label: 'Yaklaşıyor', className: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  GECIKTI: { label: 'Gecikti', className: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  TAMAMLANDI: { label: 'Tamamlandı', className: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  TAMAMLANDI_ONAY_BEKLIYOR: { label: 'Onay Bekliyor', className: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  ONAYLANDI: { label: 'Onaylandı', className: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  REVIZYON_ISTENDI: { label: 'Revizyon İstendi', className: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  ERTELENDI: { label: 'Ertelendi', className: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  IPTAL_EDILDI: { label: 'İptal Edildi', className: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
  ASKIYA_ALINDI: { label: 'Askıya Alındı', className: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
}

export const ONCELIK_META: Record<YillikTakvimOncelik, string> = {
  DUSUK: 'Düşük', ORTA: 'Orta', YUKSEK: 'Yüksek', KRITIK: 'Kritik',
}
export const PERIYOT_META: Record<YillikTakvimPeriyot, string> = {
  TEK_SEFERLIK: 'Tek Seferlik', GUNLUK: 'Günlük', HAFTALIK: 'Haftalık',
  IKI_HAFTADA_BIR: 'İki Haftada Bir', AYLIK: 'Aylık', IKI_AYDA_BIR: 'İki Ayda Bir',
  UC_AYLIK: 'Üç Aylık', ALTI_AYLIK: 'Altı Aylık', YILLIK: 'Yıllık',
  IKI_YILDA_BIR: 'İki Yılda Bir', UC_YILDA_BIR: 'Üç Yılda Bir',
  BELIRLI_AYLAR: 'Belirli Aylar', BELIRLI_TARIHLER: 'Belirli Tarihler', OZEL: 'Özel',
}
export const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
