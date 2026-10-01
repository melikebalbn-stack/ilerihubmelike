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
import { FifTur, FifSonuc, FifAksiyonTuru, FifKokNedenKategori, FifEtkinlikMadde, FifEkTerminDurum } from '@/generated/prisma'

/**
 * "Onaya Gönder" zorunlu alanları — tek liste (fif-durum.zorunluAlanlarTam ile AYNI).
 * Kalite kararı: yayınlayan bölüm de zorunlu. Taslak kaydında (POST/PUT) hiçbiri değil.
 */
export const FIF_ZORUNLU_ALANLAR = ['tur', 'sorumluBolumId', 'yayinlayanBolumId', 'uygunsuzlukTanimi'] as const

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
  /** Rev 3: satır bazlı aksiyon türü — ACİL (geçici müdahale) / KALICI (kök neden). */
  aksiyonTuru: z.nativeEnum(FifAksiyonTuru).nullable().optional(),
  hedefTarih: z.coerce.date().nullable().optional(),
  gerceklesenTarih: z.coerce.date().nullable().optional(),
  sonuc: z.nativeEnum(FifSonuc).nullable().optional(),
  parafUserId: idOpsiyonel,
  parafTarihi: z.coerce.date().nullable().optional(),
  /** Paket 3: satırın sorumlu kişisi (düz string userId). */
  sorumluUserId: idOpsiyonel,
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
  // TASLAK serbest kayıt: hiçbir alan POST/PUT'ta ZORUNLU DEĞİL. FIF_ZORUNLU_ALANLAR
  // (tür + sorumlu bölüm + yayınlayan bölüm + tespit) yalnız "Onaya Gönder"de uygulanır
  // (fif-durum.ts → zorunluAlanlarTam). Böylece kullanıcı boş taslak açıp
  // sekmeleri kademeli doldurabilir.
  tur: z.nativeEnum(FifTur).default(FifTur.DUZELTICI),
  sorumluBolumId: idOpsiyonel,
  uygunsuzlukTanimi: bosStr,

  // ── opsiyonel ──
  tarih: z.coerce.date().optional(),
  yayinlayanBolumId: idOpsiyonel,
  hazirlayanUserId: idOpsiyonel,
  izlemeSorumlusuUserId: idOpsiyonel,
  sorumluOnaylayanUserId: idOpsiyonel,
  yayinlayanOnaylayanUserId: idOpsiyonel,
  /**
   * Paket 3: kaynak listeden (FifKaynak). Eski serbest metin denetlemeAdi ve
   * uygulama sorumlusu (yerini satır sorumlusu aldı) artık istekten ALINMAZ;
   * DB kolonları geçmiş kayıtlar için durur.
   */
  kaynakId: idOpsiyonel,
  standartMadde: bosStr,
  // Paket 3b-2: FİF geneli "Ek Termin Nedeni" ESKİ alan — istekten ALINMAZ (nedenler
  // artık FifEkTermin talebinde). Kolon geçmiş kayıtlar için durur, formda salt-okunur.
  kokNedenAnalizi: bosStr,
  kapatmaTarihi: z.coerce.date().nullable().optional(),
  kysDegisikligi: z.boolean().optional(),
  riskFirsatGuncelleme: z.boolean().optional(),
  ogrenilenDers: z.boolean().optional(),
  /** Rev 3 yayılım değerlendirmesi — "var" ise açıklama beklenir (yayilimGecerli). */
  yayilimVarMi: z.boolean().optional(),
  yayilimAciklama: bosStr,

  // ── alt kayıtlar (Faz 1: faaliyetler create ile birlikte kabul edilir) ──
  faaliyetler: z.array(fifFaaliyetInput).optional(),
  kokNedenler: z.array(fifKokNedenInput).optional(),
  besNedenler: z.array(fifBesNedenInput).optional(),
  etkinlikler: z.array(fifEtkinlikInput).optional(),
})
export type FifInput = z.infer<typeof fifInput>

/**
 * PUT faaliyet satırı: `id` varsa mevcut satır güncellenir, yoksa yeni satır.
 * paraf/sonuc/gerceklesenTarih bu uçtan YAZILMAZ ("Faaliyeti Kapat" ucu yönetir);
 * ilkHedefTarih şemada YOK — sunucu hedef tarih ilk dolduğunda kendisi yazar.
 */
export const fifFaaliyetGuncelleInput = fifFaaliyetInput.extend({
  id: z.string().min(1).optional(),
})

/**
 * PUT (güncelleme) girişi — KISMİ: gelmeyen alan (undefined) güncellenmez.
 * Sistemin yönettiği alanlar şemada YOK (zod bilinmeyen anahtarı atar):
 * durum, kayitNo, hazirlayanUserId, kssUserId, sorumlu/yayınlayan onaylayan
 * (bölümden sunucuda çözülür), kapatmaTarihi (durum geçişi yazar).
 * `tur` yeniden tanımlı: zod v4'te `.default()` `.partial()` altında da
 * uygulanır; PUT'ta tür gönderilmediyse DUZELTICI'ye dönmemeli.
 */
export const fifGuncelleInput = fifInput
  .omit({
    hazirlayanUserId: true,
    sorumluOnaylayanUserId: true,
    yayinlayanOnaylayanUserId: true,
    kapatmaTarihi: true,
  })
  .partial()
  .extend({
    tur: z.nativeEnum(FifTur).optional(),
    faaliyetler: z.array(fifFaaliyetGuncelleInput).optional(),
  })
export type FifGuncelleInput = z.infer<typeof fifGuncelleInput>

/** Kaynak listesi (FifKaynak) — POST: yeni kaynak. */
export const fifKaynakInput = z.object({
  ad: z.string().trim().min(1, 'Kaynak adı zorunlu').max(120),
  sira: z.number().int().min(0).optional(),
})

/** Kaynak listesi — PATCH: ad / aktif / sıra (silme yok, pasife alma var). */
export const fifKaynakGuncelleInput = z.object({
  id: z.string().min(1),
  ad: z.string().trim().min(1, 'Kaynak adı zorunlu').max(120).optional(),
  aktif: z.boolean().optional(),
  sira: z.number().int().min(0).optional(),
})

/** Ek termin talebi (satır sorumlusu) — Paket 3b-2. */
export const fifEkTerminTalepInput = z.object({
  istenenHedefTarih: z.coerce.date(),
  neden: z.string().trim().min(1, 'Ek termin nedeni zorunlu').max(2000),
})

/** Ek termin kararı (KSS). Red notu zorunluluğu uçta (karar=REDDEDILDI). */
export const fifEkTerminKararInput = z.object({
  karar: z.enum([FifEkTerminDurum.ONAYLANDI, FifEkTerminDurum.REDDEDILDI]),
  kararNotu: bosStr,
})

/**
 * Faaliyet bazlı etkinlik kontrolü (KSS). uygun=false → açıklama + YENİ hedef
 * tarih zorunlu (uçta; satır yeniden açılır).
 */
export const fifFaaliyetEtkinlikInput = z.object({
  uygun: z.boolean(),
  aciklama: bosStr,
  yeniHedefTarih: z.coerce.date().nullable().optional(),
})

/**
 * Yayılım kuralı: "yayılım var" işaretlendiyse açıklama zorunlu. Saf fonksiyon —
 * uç ve (ileride) durum geçişi AYNI kuralı çağırır.
 */
export function yayilimGecerli(
  yayilimVarMi: boolean | null | undefined,
  yayilimAciklama: string | null | undefined,
): { ok: true } | { ok: false; sebep: string } {
  if (yayilimVarMi && !(yayilimAciklama ?? '').trim()) {
    return { ok: false, sebep: 'Yayılım var işaretlendiyse açıklama zorunlu' }
  }
  return { ok: true }
}
