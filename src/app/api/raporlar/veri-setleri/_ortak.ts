import { z } from 'zod'
import { Prisma } from '@/generated/prisma'
import { tanimDogrula } from '@/lib/rapor/veri-seti'
import type { VeriSetiTanim } from '@/lib/rapor/tipler'

export const TanimSchema = z.object({
  kaynaklar: z.array(z.union([
    z.object({
      ad: z.string(), tip: z.literal('ifs-odata'), projeksiyon: z.string(), entitySet: z.string(),
      select: z.array(z.string()).optional(), filtre: z.string().optional(), top: z.number().int().optional(),
    }),
    z.object({
      ad: z.string(), tip: z.literal('postgres'), sorgu: z.string(), parametreler: z.array(z.string()).optional(),
      tasarim: z.object({ tablo: z.string(), alanlar: z.array(z.string()), where: z.string().optional() }).optional(),
    }),
  ])),
  birlestir: z.array(z.object({ sol: z.string(), sag: z.string(), tip: z.enum(['inner', 'left']) })).default([]),
  alanlar: z.record(z.string(), z.string()).default({}),
})

export const VeriSetiGovde = z.object({
  ad: z.string().trim().min(2, 'Ad en az 2 karakter').max(80),
  aciklama: z.string().trim().max(500).optional().nullable(),
  tanim: TanimSchema,
  onbellekSn: z.number().int().min(0).max(86400).optional(),
  aktif: z.boolean().optional(),
})

/** zod + motor doğrulaması; hata listesi (boş = geçerli). */
export function tanimHatalari(tanim: VeriSetiTanim): string[] {
  return tanimDogrula(tanim)
}

export const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

export const uniqueIhlali = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
