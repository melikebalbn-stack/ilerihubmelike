export const YILLIK_TAKVIM_DURUMLARI = [
  'TASLAK', 'PLANLANDI', 'DEVAM_EDIYOR', 'YAKLASIYOR', 'GECIKTI',
  'TAMAMLANDI', 'TAMAMLANDI_ONAY_BEKLIYOR', 'ONAYLANDI',
  'REVIZYON_ISTENDI', 'ERTELENDI', 'IPTAL_EDILDI', 'ASKIYA_ALINDI',
] as const
export type YillikTakvimDurum = typeof YILLIK_TAKVIM_DURUMLARI[number]

export const YILLIK_TAKVIM_ONCELIKLERI = ['DUSUK', 'ORTA', 'YUKSEK', 'KRITIK'] as const
export type YillikTakvimOncelik = typeof YILLIK_TAKVIM_ONCELIKLERI[number]

export const YILLIK_TAKVIM_PERIYOTLARI = [
  'TEK_SEFERLIK', 'GUNLUK', 'HAFTALIK', 'IKI_HAFTADA_BIR', 'AYLIK',
  'IKI_AYDA_BIR', 'UC_AYLIK', 'ALTI_AYLIK', 'YILLIK', 'IKI_YILDA_BIR',
  'UC_YILDA_BIR', 'BELIRLI_AYLAR', 'BELIRLI_TARIHLER', 'OZEL',
] as const
export type YillikTakvimPeriyot = typeof YILLIK_TAKVIM_PERIYOTLARI[number]

export const YILLIK_TAKVIM_GERCEKLESME_DURUMLARI = [
  'BEKLIYOR', 'GERCEKLESTI', 'GERCEKLESMEDI', 'DEVREDILDI', 'PLANDISI',
] as const
export type YillikTakvimGerceklesmeDurumu = typeof YILLIK_TAKVIM_GERCEKLESME_DURUMLARI[number]

export const YILLIK_TAKVIM_KATILIMCI_ROLLERI = [
  'ANA_SORUMLU', 'YEDEK_SORUMLU', 'ONAYLAYAN',
  'IKINCI_ONAYLAYAN', 'BILGILENDIRILECEK',
] as const
export type YillikTakvimKatilimciRol = typeof YILLIK_TAKVIM_KATILIMCI_ROLLERI[number]

export interface YillikTakvimKaydiRow {
  id: string
  anaKonu: string
  surec: string
  kisaBaslik: string | null
  oncelik: YillikTakvimOncelik
  periyot: YillikTakvimPeriyot
  durum: YillikTakvimDurum
  baslangicTarihi: string | null
  bitisTarihi: string | null
  nihaiSonTarih: string | null
  plananUygulamaTarihi: string | null
  iptalMi: boolean
  kalanGun: number | null
  kaynakModul: string | null
  gerceklesmeDurumu: YillikTakvimGerceklesmeDurumu
  gerceklesmeTarihi: string | null
  department: { id: string; name: string } | null
  katilimcilar: { rol: YillikTakvimKatilimciRol; user: { name: string | null; email: string } }[]
}

export function getKayitTarihi(kayit: YillikTakvimKaydiRow): Date | null {
  const raw = kayit.nihaiSonTarih ?? kayit.bitisTarihi ?? kayit.baslangicTarihi
  return raw ? new Date(raw) : null
}

export function getAnaSorumluAdi(kayit: YillikTakvimKaydiRow): string {
  const ana = kayit.katilimcilar.find(k => k.rol === 'ANA_SORUMLU')
  return ana?.user.name || ana?.user.email || '—'
}
