/**
 * Şablon türlerinin KULLANICIYA GÖRÜNEN adları. İç kodlar ('etkilesimli' / 'belge') DB'de ve
 * API'de aynen kalır — yalnız gösterim değişir.
 */
import type { SablonIcerikHer } from './tipler'

export const TUR_ADI: Record<'etkilesimli' | 'belge', string> = {
  etkilesimli: 'AI Rapor',
  belge: 'Hazır Rapor',
}

export const TUR_ACIKLAMA: Record<'etkilesimli' | 'belge', string> = {
  etkilesimli: 'Ekranda bakılır. Doğal dille sorarsın; grupla, filtrele, grafik ekle, Excel veya PDF al.',
  belge: 'Basılı belge. Kâğıt/PDF için sabit tasarım — iş emri föyü, form, liste.',
}

export const turAdi = (icerikVeyaTur: SablonIcerikHer | 'etkilesimli' | 'belge'): string =>
  TUR_ADI[typeof icerikVeyaTur === 'string' ? icerikVeyaTur : icerikVeyaTur.tur === 'etkilesimli' ? 'etkilesimli' : 'belge']
