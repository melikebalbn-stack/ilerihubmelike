/**
 * Kalite uygunsuzluk (KAL-KYT-15 Bölüm 2) — Zod şemaları. TEK KAYNAK: API + form aynısını kullanır.
 *
 * `no` OTOMATİK üretilir → istekte KABUL EDİLMEZ (şemada yok).
 *
 * ⚠ Referans kısıtı (tespitEdenBolumId/olusanBolumId → tip=BOLUM, hataKoduId → tip=KOD)
 *   BURADA DEĞİL: DB'ye bakmak gerektiği için route katmanında,
 *   `uygunsuzluk-refs.ts` içindeki tek yardımcıda toplandı.
 */
import { z } from 'zod'
import { UygunsuzlukKarar } from '@/generated/prisma'

/** Boş/whitespace metni null'a çevirir, dolu metni trim'ler. */
const bosStr = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null || v.trim() === '' ? null : v.trim()))

/** Opsiyonel id alanı: boş string → null. */
const bosId = z.string().min(1).optional().nullable()

export const uygunsuzlukSatirInput = z.object({
  siraNo: z.number().int().min(1),
  yariMamulKodu: bosStr,
  malzemeAdi: bosStr,
  redAdeti: z.number().int().min(1, 'Red adeti en az 1 olmalı'),
  reworkAdedi: z.number().int().min(0).optional().nullable(),
  olusanBolumId: bosId,
  hataKoduId: bosId,
  hataDetayi: bosStr,
  karar: z.nativeEnum(UygunsuzlukKarar).optional().nullable(),
})

export type UygunsuzlukSatirInput = z.infer<typeof uygunsuzlukSatirInput>

export const uygunsuzlukInput = z
  .object({
    // Zod v4: `required_error` kaldırıldı, karşılığı `error`.
    tarih: z.coerce.date({ error: 'Tarih zorunlu' }),
    mamulUrunKodu: z.string().trim().min(1, 'Mamul ürün kodu zorunlu'),
    isEmriNo: z.string().trim().min(1, 'İş emri no zorunlu'),
    isEmriAdeti: z.number().int().min(1, 'İş emri adeti en az 1 olmalı').optional().nullable(),
    tespitEdenBolumId: bosId,
    kokNeden: bosStr,
    duzelticiFaaliyet: bosStr,
    sorumluId: bosId,
    termin: z.coerce.date().optional().nullable(),
    kapanisTarihi: z.coerce.date().optional().nullable(),
    satirlar: z.array(uygunsuzlukSatirInput).min(1, 'En az bir ürün satırı zorunlu'),
  })
  .superRefine((data, ctx) => {
    // rework <= red (satır bazında, hangi satır belirtilir)
    data.satirlar.forEach((s, i) => {
      const rework = s.reworkAdedi ?? 0
      if (rework > s.redAdeti) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['satirlar', i],
          message: `Satır ${s.siraNo}: rework (${rework}), red adetini (${s.redAdeti}) aşamaz`,
        })
      }
    })
    // kapanisTarihi < tarih olamaz (ikisi de doluysa)
    if (data.kapanisTarihi && data.kapanisTarihi.getTime() < data.tarih.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['kapanisTarihi'],
        message: 'Kapanış tarihi, uygunsuzluk tarihinden önce olamaz',
      })
    }
  })

export type UygunsuzlukInput = z.infer<typeof uygunsuzlukInput>
