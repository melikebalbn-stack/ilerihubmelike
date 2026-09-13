/**
 * FİF (KAL-FR-10) doğrulama — TEK KAYNAK.
 *
 * ZORUNLULUK POLİTİKASI (Faz 1): yalnız `tur` + `sorumluBolumId` +
 * `uygunsuzlukTanimi` (tespit) zorunlu; geri kalan her şey opsiyonel. DB
 * kolonları da geçirgen (nullable) — sıkılaştırma tek yerden (aşağıdaki
 * FIF_ZORUNLU_ALANLAR + ilgili zod alanları) yapılır, DB migration gerekmeden.
 *
 * `kayitNo` ve `durum` istekten KABUL EDİLMEZ (sunucu üretir/yönetir).
 * Kullanıcı/bölüm alanları düz string id (audit deseni).
 */
import { z } from 'zod'
import { FifTur, FifSonuc, FifKokNedenKategori, FifEtkinlikMadde } from '@/generated/prisma'

/** Faz 1 zorunlu alanlar — tek liste; ileride buraya ekleyerek sıkılaştır. */
export const FIF_ZORUNLU_ALANLAR = ['tur', 'sorumluBolumId', 'uygunsuzlukTanimi'] as const

const bosStr = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const idOpsiyonel = z.string().min(1).nullable().optional()

export const fifFaaliyetInput = z.object({
  sira: z.number().int().min(1),
  aciklama: z.string().trim().min(1, 'Faaliyet açıklaması zorunlu'),
  hedefTarih: z.coerce.date().nullable().optional(),
  gerceklesenTarih: z.coerce.date().nullable().optional(),
  sonuc: z.nativeEnum(FifSonuc).nullable().optional(),
  parafUserId: idOpsiyonel,
  parafTarihi: z.coerce.date().nullable().optional(),
})
export type FifFaaliyetInput = z.infer<typeof fifFaaliyetInput>

export const fifKokNedenInput = z.object({
  kategori: z.nativeEnum(FifKokNedenKategori),
  aciklama: z.string().trim().min(1),
})

export const fifBesNedenInput = z.object({
  muhtemelSebep: z.string().trim().min(1),
  neden1: bosStr,
  neden2: bosStr,
  neden3: bosStr,
  neden4: bosStr,
  neden5: bosStr,
})

export const fifEtkinlikInput = z.object({
  madde: z.nativeEnum(FifEtkinlikMadde),
  planlananTarih: z.coerce.date().nullable().optional(),
  gerceklesenTarih: z.coerce.date().nullable().optional(),
  uygun: z.boolean().nullable().optional(),
  onayUserId: idOpsiyonel,
  onayTarihi: z.coerce.date().nullable().optional(),
})

/** Ana FİF girişi (create/update ortak). */
export const fifInput = z.object({
  // ── Faz 1 zorunlu ──
  tur: z.nativeEnum(FifTur),
  sorumluBolumId: z.string().min(1, 'Sorumlu bölüm zorunlu'),
  uygunsuzlukTanimi: z.string().trim().min(1, 'Tespit (uygunsuzluk tanımı) zorunlu'),

  // ── opsiyonel ──
  tarih: z.coerce.date().optional(),
  yayinlayanBolumId: idOpsiyonel,
  hazirlayanUserId: idOpsiyonel,
  izlemeSorumlusuUserId: idOpsiyonel,
  sorumluOnaylayanUserId: idOpsiyonel,
  yayinlayanOnaylayanUserId: idOpsiyonel,
  uygulamaSorumlusuUserId: idOpsiyonel,
  takipSorumlusuUserId: idOpsiyonel,
  denetlemeAdi: bosStr,
  standartMadde: bosStr,
  ekTerminNedeni: bosStr,
  kokNedenAnalizi: bosStr,
  kapatmaTarihi: z.coerce.date().nullable().optional(),
  kysDegisikligi: z.boolean().optional(),
  riskFirsatGuncelleme: z.boolean().optional(),
  ogrenilenDers: z.boolean().optional(),

  // ── alt kayıtlar (Faz 1: faaliyetler create ile birlikte kabul edilir) ──
  faaliyetler: z.array(fifFaaliyetInput).optional(),
  kokNedenler: z.array(fifKokNedenInput).optional(),
  besNedenler: z.array(fifBesNedenInput).optional(),
  etkinlikler: z.array(fifEtkinlikInput).optional(),
})
export type FifInput = z.infer<typeof fifInput>
