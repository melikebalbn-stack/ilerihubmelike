import { z } from 'zod'
import { Prisma } from '@/generated/prisma'

const BicimSchema = z.enum(['#.##0', '#.##0,00', '%0,0', '%0,00', 'gg.aa.yyyy', 'gg.aa.yyyy ss:dd', 'metin'])

const ParametreSchema = z.object({ ad: z.string(), tip: z.enum(['metin', 'sayi', 'tarih', 'liste']), etiket: z.string(), zorunlu: z.boolean().optional() })
const HesaplananSchema = z.object({ ad: z.string(), ifade: z.string(), bicim: BicimSchema.optional() })

/** Etkileşimli görünüm (tipler.ts → Gorunum). */
export const GorunumSchema = z.object({
  kolonlar: z.array(z.object({ alan: z.string(), baslik: z.string().optional(), gorunur: z.boolean(), toplam: z.enum(['topla', 'ortalama', 'say', 'enkucuk', 'enbuyuk']).optional(), bicim: BicimSchema.optional() })),
  gruplar: z.array(z.string()).max(2, 'En fazla 2 grup seviyesi'),
  siralama: z.object({ alan: z.string(), yon: z.union([z.literal(1), z.literal(-1)]) }).nullable().optional(),
  filtreler: z.record(z.string(), z.string()).default({}),
  grafik: z.object({ grupla: z.string(), deger: z.string(), fn: z.enum(['topla', 'ortalama']) }).nullable().optional(),
  hesaplananAlanlar: z.array(HesaplananSchema).optional(),
})

const HizaSchema = z.enum(['sol', 'orta', 'sag'])
const KosulluBicimSchema = z.object({ kosul: z.string(), renk: z.enum(['kritik', 'iyi', 'uyari']).optional(), kalin: z.boolean().optional() })
const OgeOrtak = {
  id: z.string().min(1),
  bant: z.enum(['rb', 'sb', 'gb', 'dt', 'gs', 'rs', 'sa']),
  x: z.number(), y: z.number(), w: z.number(), h: z.number(),
  size: z.number().optional(), kalin: z.boolean().optional(), hiza: HizaSchema.optional(), renk: z.string().max(32).optional(),
  dikeyHiza: z.enum(['ust', 'orta', 'alt']).optional(), zemin: z.string().max(32).optional(),
}
const ToplamFnSchema = z.enum(['topla', 'ortalama', 'say', 'enbuyuk', 'enkucuk', 'orani', 'yok'])

/** Tuval (serbest yerleşim) tasarımı — tipler.ts → TuvalTasarim. */
export const TuvalSchema = z.object({
  sayfa: z.object({ boyut: z.literal('A4'), yon: z.enum(['dikey', 'yatay']), kenar: z.tuple([z.number(), z.number(), z.number(), z.number()]) }),
  bantlar: z.array(z.object({ id: z.enum(['rb', 'sb', 'gb', 'dt', 'gs', 'rs', 'sa']), yukseklik: z.number().min(0).max(2000), yeniSayfa: z.boolean().optional() })),
  ogeler: z.array(z.discriminatedUnion('tip', [
    z.object({ ...OgeOrtak, tip: z.literal('metin'), metin: z.string().max(500) }),
    z.object({ ...OgeOrtak, tip: z.literal('alan'), alan: z.string(), bicim: BicimSchema.optional(), kosulluBicim: z.array(KosulluBicimSchema).optional() }),
    z.object({ ...OgeOrtak, tip: z.literal('toplam'), fn: ToplamFnSchema, alan: z.string(), oraniPay: z.string().optional(), oraniPayda: z.string().optional(), bicim: BicimSchema.optional(), kosulluBicim: z.array(KosulluBicimSchema).optional() }),
    z.object({ ...OgeOrtak, tip: z.literal('gorsel'), kaynak: z.enum(['logo', 'yukleme']), url: z.string().max(500).optional(), dosyaId: z.string().max(120).optional(), oraniKoru: z.boolean().optional() }),
    z.object({ ...OgeOrtak, tip: z.literal('cizgi'), kalinlik: z.number().optional() }),
    z.object({ ...OgeOrtak, tip: z.literal('kutu'), kalinlik: z.number().optional() }),
    z.object({ ...OgeOrtak, tip: z.literal('tablo'), kolonlar: z.array(z.object({ alan: z.string(), baslik: z.string(), genislik: z.number() })) }),
    z.object({ ...OgeOrtak, tip: z.literal('grafik'), grafikTipi: z.literal('sutun'), grupla: z.string(), deger: z.string(), fn: z.enum(['topla', 'ortalama']) }),
  ])).max(500),
  grup: z.object({ alan: z.string(), baslik: z.string().optional() }).optional(),
})

export const EtkilesimliIcerikSchema = z.object({
  tur: z.literal('etkilesimli'),
  baslik: z.string(),
  altBaslik: z.string().optional(),
  teknikAciklama: z.string().trim().max(500).optional(),
  kategori: z.string().trim().max(60).optional(),
  parametreler: z.array(ParametreSchema).optional(),
  gorunum: GorunumSchema,
})

export const BelgeIcerikSchema = z.object({
  tur: z.literal('belge').optional(),
  baslik: z.string(),
  altBaslik: z.string().optional(),
  teknikAciklama: z.string().trim().max(500).optional(),
  kategori: z.string().trim().max(60).optional(),
  yerlesim: z.enum(['liste', 'tuval']).optional(),
  tuval: TuvalSchema.optional(),
  parametreler: z.array(ParametreSchema).optional(),
  hesaplananAlanlar: z.array(HesaplananSchema).optional(),
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

/** `tur` alanına göre ayrışır; tur yoksa belge. */
export const IcerikSchema = z.union([EtkilesimliIcerikSchema, BelgeIcerikSchema])

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
