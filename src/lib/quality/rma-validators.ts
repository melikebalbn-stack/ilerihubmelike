/**
 * RMA/SMA İade Formu (KAL-KYT-16) — Zod şemaları. TEK KAYNAK: API + (PR-2) form aynısını kullanır.
 * `no` OTOMATİK üretilir → istekte KABUL EDİLMEZ (şemada yok).
 */
import { z } from 'zod'
import { RmaTip, RmaIadeTuru, RmaKarar, RmaDurum } from '@/generated/prisma'

const bosStr = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null || v.trim() === '' ? null : v.trim()))

/** urunKodu: trim + DÜZ büyük harf (toLocaleUpperCase('tr-TR') KULLANMA). */
const urunKodu = z
  .string()
  .trim()
  .min(1, 'Ürün kodu zorunlu')
  .transform((v) => v.toUpperCase())

export const rmaSatirInput = z.object({
  siraNo: z.number().int().min(1),
  urunKodu,
  lotNo: bosStr,
  iadeMiktari: z.number().int().min(1, 'İade miktarı en az 1 olmalı'),
  musteriIadeSebebi: z
    .string()
    .trim()
    .min(1, 'Müşteri iade sebebi zorunlu'),
  ilkIncelemeSonucu: bosStr,
  karar: z.nativeEnum(RmaKarar).optional().nullable(),
  kararAciklama: bosStr,
  hurdaAdedi: z.number().int().min(0).optional().nullable(),
  reworkAdedi: z.number().int().min(0).optional().nullable(),
  kokNeden: bosStr,
  aksiyon: bosStr,
})

export type RmaSatirInput = z.infer<typeof rmaSatirInput>

export const rmaKayitInput = z
  .object({
    tip: z.nativeEnum(RmaTip),
    urunGelisTarihi: z.coerce.date().optional().nullable(),
    irsaliyeTarihi: z.coerce.date().optional().nullable(),
    irsaliyeNo: bosStr,
    musteriId: z.string().min(1, 'Müşteri zorunlu'),
    iadeTuru: z.nativeEnum(RmaIadeTuru),
    sorumluId: z.string().min(1).optional().nullable(),
    termin: z.coerce.date().optional().nullable(),
    kapanisTarihi: z.coerce.date().optional().nullable(),
    // Durum ELLE seçilir; kapanisTarihi'nden türetilmez. Eski istemciler alanı
    // göndermezse ACIK varsayılır (DB default'u ile aynı).
    durum: z.nativeEnum(RmaDurum).default(RmaDurum.ACIK),
    maliyet: z.number().nonnegative().optional().nullable(),
    satirlar: z.array(rmaSatirInput).min(1, 'En az bir ürün satırı zorunlu'),
  })
  .superRefine((data, ctx) => {
    // hurda + rework <= iadeMiktari (satır bazında, hangi satır belirtilir)
    data.satirlar.forEach((s, i) => {
      const toplam = (s.hurdaAdedi ?? 0) + (s.reworkAdedi ?? 0)
      if (toplam > s.iadeMiktari) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['satirlar', i],
          message: `Satır ${s.siraNo}: hurda (${s.hurdaAdedi ?? 0}) + rework (${s.reworkAdedi ?? 0}) = ${toplam}, iade miktarını (${s.iadeMiktari}) aşamaz`,
        })
      }
    })
    // kapanisTarihi < irsaliyeTarihi olamaz (ikisi de doluysa)
    if (
      data.kapanisTarihi &&
      data.irsaliyeTarihi &&
      data.kapanisTarihi.getTime() < data.irsaliyeTarihi.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['kapanisTarihi'],
        message: 'Kapanış tarihi, irsaliye tarihinden önce olamaz',
      })
    }
  })

export type RmaKayitInput = z.infer<typeof rmaKayitInput>

/**
 * Sorumlu kolu PATCH şeması — kayda sorumlu atanmış, rma.manage'ı OLMAYAN kişi.
 * YALNIZ satır bazında kokNeden + aksiyon. `.strict()`: başlık alanı ya da başka
 * satır alanı gönderilirse istek 400 döner (sessizce yutulmaz).
 */
export const rmaSorumluPatchInput = z
  .object({
    satirlar: z
      .array(
        z
          .object({
            id: z.string().min(1, 'Satır id zorunlu'),
            kokNeden: bosStr,
            aksiyon: bosStr,
          })
          .strict(),
      )
      .min(1, 'En az bir satır gerekli'),
  })
  .strict()

export type RmaSorumluPatchInput = z.infer<typeof rmaSorumluPatchInput>
