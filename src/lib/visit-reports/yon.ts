/**
 * Ziyaret Raporları — YÖN sözlüğü (TEK KAYNAK).
 *
 * Modül baştan "giden ziyaret" varsayımıyla yazılmıştı: şemada `companyName`
 * yorumu "Ziyaret edilen firma", formda "İleri Group'tan Gidenler" gibi tek yönlü
 * etiketler vardı. `VisitReport.direction` ile iki yön ayrıldı; arayüzdeki her
 * yönlü metin buradan okunur ki liste/form/detay ayrışmasın.
 *
 * ÖNEMLİ: `ParticipantCompany` enum DEĞERLERİ değişmez (ILERI_GROUP /
 * VISITED_COMPANY) — yalnız ekranda gösterilen etiketleri yöne göre değişir.
 */

export type VisitDirection = 'OUTGOING' | 'INCOMING'

export interface YonEtiketleri {
  /** Yön seçim kartının başlığı. */
  kartBaslik: string
  kartAciklama: string
  /** Liste rozetinde görünen kısa metin. */
  rozet: string
  /** Alan etiketleri */
  firma: string
  yer: string
  bizimkiler: string
  onlar: string
  /** Katılımcı bölümünde karşı taraf grubunun etiketi (enum değeri değişmez). */
  karsiTaraf: string
  /** Placeholder'lar — gerçek müşteri adı KULLANILMAZ, nötr örnek verilir. */
  firmaPlaceholder: string
  yerPlaceholder: string
  /** Yer alanı için varsayılan öneri (boşsa öneri yok). */
  yerVarsayilan: string
}

export const YON: Record<VisitDirection, YonEtiketleri> = {
  OUTGOING: {
    kartBaslik: 'Ziyarete gittik',
    kartAciklama: 'İleri Group ekibi karşı tarafın tesisine/etkinliğine gitti',
    rozet: '↗ Gittik',
    firma: 'Ziyaret Edilen Firma',
    yer: 'Ziyaret Yeri / Adres',
    bizimkiler: "İleri Group'tan Gidenler",
    onlar: 'Görüşülen Kişiler',
    karsiTaraf: 'Ziyaret edilen firmadan',
    firmaPlaceholder: 'Örnek: Ziyaret edilen firma adı',
    yerPlaceholder: 'Örnek: Firma tesisi / toplantı adresi',
    yerVarsayilan: '',
  },
  INCOMING: {
    kartBaslik: 'Ziyaretçi ağırladık',
    kartAciklama: 'Karşı taraf İleri Group tesisine/ofisine geldi',
    rozet: '↘ Ağırladık',
    firma: 'Ziyaretçi Firma',
    yer: 'Görüşme Yeri',
    bizimkiler: "İleri Group'tan Karşılayanlar",
    onlar: 'Gelen Kişiler',
    karsiTaraf: 'Ziyaretçi firmadan',
    firmaPlaceholder: 'Örnek: Tedarikçi firma adı',
    yerPlaceholder: 'Örnek: Tesisimiz / toplantı salonu',
    yerVarsayilan: 'Tesisimiz',
  },
}

/** Bilinmeyen/eksik değerlerde güvenli varsayılan (eski kayıtlar OUTGOING). */
export function yonEtiket(direction: string | null | undefined): YonEtiketleri {
  return direction === 'INCOMING' ? YON.INCOMING : YON.OUTGOING
}

export function gecerliYon(v: unknown): VisitDirection {
  return v === 'INCOMING' ? 'INCOMING' : 'OUTGOING'
}
