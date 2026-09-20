import { z } from 'zod'
import { Prisma } from '@/generated/prisma'

const BicimSchema = z.enum(['#.##0', '#.##0,00', '%0,0', '%0,00', 'gg.aa.yyyy', 'gg.aa.yyyy ss:dd', 'metin'])

export const IcerikSchema = z.object({
  baslik: z.string(),
  altBaslik: z.string().optional(),
  parametreler: z.array(z.object({ ad: z.string(), tip: z.enum(['metin', 'sayi', 'tarih', 'liste']), etiket: z.string(), zorunlu: z.boolean().optional() })).optional(),
  hesaplananAlanlar: z.array(z.object({ ad: z.string(), ifade: z.string(), bicim: BicimSchema.optional() })).optional(),
  gruplar: z.array(z.object({ alan: z.string(), baslik: z.string().optional(), yeniSayfa: z.boolean().optional() })).optional(),
  kolonlar: z.array(z.object({
    alan: z.string(), baslik: z.string(), genislik: z.number().optional(), hiza: z.enum(['sol', 'sag', 'orta']).optional(), bicim: BicimSchema.optional(),
    kosulluBicim: z.array(z.object({ kosul: z.string(), renk: z.enum(['kritik', 'iyi', 'uyari']).optional(), kalin: z.boolean().optional() })).optional(),
    altToplam: z.enum(['topla', 'ortalama', 'say', 'enbuyuk', 'enkucuk', 'orani', 'yok']).optional(),
    oraniPay: z.string().optional(), oraniPayda: z.string().optional(),
  })),
  genelToplam: z.boolean().optional(),
  sayfaAlti: z.object({ sol: z.string().optional(), sag: z.string().optional() }).optional(),
})

export const SablonGovde = z.object({
  kod: z.string().trim().min(2, 'Kod en az 2 karakter').max(40).regex(/^[A-Za-z0-9_-]+$/, 'Kod yalnız harf/rakam/-/_ içerebilir'),
  ad: z.string().trim().min(2, 'Ad en az 2 karakter').max(120),
  aciklama: z.string().trim().max(500).optional().nullable(),
  veriSetiId: z.string().min(1, 'Veri seti seçilmeli'),
  icerik: IcerikSchema,
  durum: z.enum(['TASLAK', 'YAYINDA', 'ARSIV']).default('TASLAK'),
  izinAnahtari: z.string().trim().max(80).optional().nullable(),
})

export const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue
// instanceof yerine kod denetimi: $transaction içinden gelen hata farklı runtime örneğinden olabiliyor.
export const uniqueIhlali = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'
export const zodMesaj = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
