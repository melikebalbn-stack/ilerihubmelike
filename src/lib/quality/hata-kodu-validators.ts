/**
 * Kalite hata kodu (KAL-KYT-15 Bölüm 1) — Zod şemaları. TEK KAYNAK: API + form aynısını kullanır.
 *
 * DÜZ liste — hiyerarşi YOK. `ustKodId`, döngü kontrolü ve kendi kendine bağlanma
 * kontrolü 2026-08-09'da kaldırıldı (kaynak Excel'de üst/alt ilişkisi yok).
 *
 * `kod` yalnız POST'ta kabul edilir; PATCH şemasında YOKTUR — kod DEĞİŞMEZ
 * (873 geçmiş kayıt kod değerine bağlı).
 */
import { z } from 'zod'

/** Boş/whitespace metni null'a çevirir, dolu metni trim'ler. */
const bosStr = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null || v.trim() === '' ? null : v.trim()))

const ad = z
  .string()
  .trim()
  .min(2, 'Hata kodu adı en az 2 karakter olmalı')
  .max(200, 'Hata kodu adı en fazla 200 karakter olabilir')

export const hataKoduCreateInput = z.object({
  kod: z
    .number()
    .int('Kod tam sayı olmalı')
    .min(1, 'Kod en az 1 olmalı')
    .max(9999, 'Kod en fazla 9999 olabilir'),
  ad,
  aktif: z.boolean().optional(),
  /** Verilmezse API `kod` değerini kullanır. */
  siraNo: z.number().int().optional(),
  aciklama: bosStr,
})

export type HataKoduCreateInput = z.infer<typeof hataKoduCreateInput>

/**
 * PATCH — kısmi güncelleme. Gönderilmeyen alan DEĞİŞMEZ.
 * `kod` kasıtlı olarak yok; istekte gelirse sessizce yok sayılır.
 */
export const hataKoduUpdateInput = z
  .object({
    ad: ad.optional(),
    aktif: z.boolean().optional(),
    siraNo: z.number().int().optional(),
    aciklama: bosStr.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Güncellenecek en az bir alan gönderin' })

export type HataKoduUpdateInput = z.infer<typeof hataKoduUpdateInput>
