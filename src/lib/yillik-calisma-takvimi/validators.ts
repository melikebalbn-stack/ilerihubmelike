import { z } from 'zod'
import { YillikTakvimKayitTuru, YillikTakvimOncelik, YillikTakvimPeriyot } from '@/generated/prisma'

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG formatında olmalıdır').refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}, 'Geçersiz tarih')

const OptionalText = (max: number) => z.string().trim().max(max).nullable().optional()

export const YillikTakvimCreateSchema = z.object({
  yil: z.number().int().min(2000).max(2100),
  anaKonu: z.string().trim().min(1, 'Ana konu zorunludur').max(300),
  surec: z.string().trim().min(1, 'Başlık/süreç zorunludur').max(300),
  aciklama: OptionalText(5000),
  departmentId: z.string().trim().min(1, 'Departman zorunludur').max(100),
  anaSorumluEmail: z.string().trim().email('Geçerli bir ana sorumlu seçilmelidir').max(320),
  nihaiSonTarih: DateOnly,
  plananUygulamaTarihi: DateOnly.nullable().optional(),
  periyot: z.nativeEnum(YillikTakvimPeriyot),
  oncelik: z.nativeEnum(YillikTakvimOncelik).optional(),
  kayitTuru: z.nativeEnum(YillikTakvimKayitTuru).optional(),
  kisaBaslik: OptionalText(200),
  disKurum: OptionalText(200),
}).strict()

export type YillikTakvimCreateInput = z.infer<typeof YillikTakvimCreateSchema>

export function dateOnlyToUtc(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}
