import { NextResponse } from 'next/server'
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
      sqlMetin: z.string().optional(),
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

/**
 * Gövde çözümleme + doğrulama — POST (oluştur) ve PUT (güncelle) AYNI yolu kullanır.
 * Hata varsa hazır NextResponse döner; başarıda doğrulanmış gövde.
 */
export async function veriSetiGovdesi(req: Request): Promise<{ veri: z.infer<typeof VeriSetiGovde>; hata?: undefined } | { veri?: undefined; hata: NextResponse }> {
  const govde = VeriSetiGovde.safeParse(await req.json().catch(() => null))
  if (!govde.success) {
    return { hata: NextResponse.json({ error: govde.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 }) }
  }
  const hatalar = tanimHatalari(govde.data.tanim as VeriSetiTanim)
  if (hatalar.length) return { hata: NextResponse.json({ error: 'Tanım geçersiz', hatalar }, { status: 400 }) }
  return { veri: govde.data }
}

/** zod + motor doğrulaması; hata listesi (boş = geçerli). */
export function tanimHatalari(tanim: VeriSetiTanim): string[] {
  return tanimDogrula(tanim)
}

export const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

// instanceof yerine kod denetimi: $transaction içinden gelen hata farklı runtime örneğinden olabiliyor.
export const uniqueIhlali = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'
