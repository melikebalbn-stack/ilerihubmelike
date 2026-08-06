import { z } from 'zod'

// IV-FR-24 — eleman talebi ek alanları. TEK KAYNAK doğrulama.
// İki grup: (1) talep edenin (birim) doldurduğu alanlar, (2) yalnız İK'nın doldurduğu
// İnsan Varlıkları kapanış alanları. Hepsi opsiyonel/nullable (prod'da 0 kayıt, additive).

// ── (1) Talep eden alanları (İV kapanış HARİÇ) ──────────────────────────────
export const talepAlanlariSchema = z
  .object({
    formHazirlanmaTarihi: z.string().nullish(),
    ikTeslimTarihi: z.string().nullish(),
    kisilikOzellikleri: z.string().nullish(),
    egitimSeviyesi: z.enum(['LISE', 'TEKNIK_LISE', 'ON_LISANS', 'LISANS', 'YUKSEK_LISANS', 'DIGER']).nullish(),
    egitimDiger: z.string().nullish(),
    tecrubeDurumu: z.enum(['TECRUBELI', 'YENI_MEZUN']).nullish(),
    tecrubeSuresi: z.string().nullish(),
    yabanciDilGerekli: z.boolean().nullish(),
    yabanciDiller: z.any().nullish(), // [{dil, seviye}]
    bilgisayarBilgisi: z.string().nullish(),
    kaliteSistemBilgisi: z.string().nullish(),
    ehliyetGerekli: z.boolean().nullish(),
    ehliyetSinifi: z.string().nullish(),
    digerBelgeIhtiyaci: z.string().nullish(),
    cinsiyetTercihi: z.enum(['BAY', 'BAYAN', 'FARKETMEZ']).nullish(),
    yasAraligiMin: z.number().int().nullish(),
    yasAraligiMax: z.number().int().nullish(),
    askerlikGerekli: z.boolean().nullish(),
    ayrilanPersonelAdi: z.string().nullish(),
  })
  .refine(
    (d) => d.yasAraligiMin == null || d.yasAraligiMax == null || d.yasAraligiMin <= d.yasAraligiMax,
    { message: 'Yaş aralığı: alt sınır üst sınırdan büyük olamaz.', path: ['yasAraligiMax'] },
  )

// ── (2) İnsan Varlıkları kapanış alanları — YALNIZ İK doldurur ──────────────
export const ivKapanisSchema = z.object({
  adayKaynaklari: z.any().nullish(), // çoklu seçim kod dizisi
  ilanPortallari: z.string().nullish(),
  adayKaynagiDiger: z.string().nullish(),
  kadroDoldurulmaTarihi: z.string().nullish(),
  iseBaslayanPersonelAdi: z.string().nullish(),
})

// İV kapanış alan adları (route'ta "talep eden bu alanları GÖNDERDİYSE reddet/yok say" için).
export const IV_KAPANIS_ALANLARI = [
  'adayKaynaklari',
  'ilanPortallari',
  'adayKaynagiDiger',
  'kadroDoldurulmaTarihi',
  'iseBaslayanPersonelAdi',
  'ivOnayId',
  'ivOnayTarihi',
] as const

// Tarih string → Date | null (create/update data'ya yazarken).
export function tarihDon(v: unknown): Date | null {
  return v ? new Date(v as string) : null
}
