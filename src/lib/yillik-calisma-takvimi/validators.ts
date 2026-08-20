import { z } from 'zod'
import { YillikTakvimGerceklesmeDurumu, YillikTakvimKayitTuru, YillikTakvimOnayKarari, YillikTakvimOncelik, YillikTakvimPeriyot } from '@/generated/prisma'

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG formatında olmalıdır').refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}, 'Geçersiz tarih')

const OptionalText = (max: number) => z.string().trim().max(max).nullable().optional()
const UserEmail = (message?: string) => z.string().trim().email(message).max(320)

export const YillikTakvimCreateSchema = z.object({
  yil: z.number().int().min(2000).max(2100),
  anaKonu: z.string().trim().min(1, 'Ana konu zorunludur').max(300),
  surec: z.string().trim().min(1, 'Başlık/süreç zorunludur').max(300),
  aciklama: OptionalText(5000),
  departmentId: z.string().trim().min(1, 'Departman zorunludur').max(100),
  anaSorumluEmail: UserEmail('Geçerli bir ana sorumlu seçilmelidir'),
  yedekSorumluEmail: UserEmail().nullable().optional(),
  bilgilendirilecekEmailler: z.array(UserEmail()).optional(),
  nihaiSonTarih: DateOnly,
  plananUygulamaTarihi: DateOnly.nullable().optional(),
  periyot: z.nativeEnum(YillikTakvimPeriyot),
  oncelik: z.nativeEnum(YillikTakvimOncelik).optional(),
  kayitTuru: z.nativeEnum(YillikTakvimKayitTuru).optional(),
  kisaBaslik: OptionalText(200),
  disKurum: OptionalText(200),
}).strict()

export type YillikTakvimCreateInput = z.infer<typeof YillikTakvimCreateSchema>

export const YillikTakvimUpdateSchema = z.object({
  anaKonu: z.string().trim().min(1).max(300).optional(),
  surec: z.string().trim().min(1).max(300).optional(),
  kisaBaslik: OptionalText(200),
  aciklama: OptionalText(5000),
  departmentId: z.string().trim().min(1).max(100).optional(),
  anaSorumluEmail: UserEmail().optional(),
  yedekSorumluEmail: UserEmail().nullable().optional(),
  bilgilendirilecekEmailler: z.array(UserEmail()).optional(),
  nihaiSonTarih: DateOnly.optional(),
  plananUygulamaTarihi: DateOnly.nullable().optional(),
  periyot: z.nativeEnum(YillikTakvimPeriyot).optional(),
  oncelik: z.nativeEnum(YillikTakvimOncelik).optional(),
  disKurum: OptionalText(200),
  gerceklesmeDurumu: z.nativeEnum(YillikTakvimGerceklesmeDurumu).optional(),
  gerceklesmeTarihi: DateOnly.nullable().optional(),
  gerceklesmemeNedeni: OptionalText(2000),
}).strict().refine(value => Object.keys(value).length > 0, 'En az bir alan gönderilmelidir')

export type YillikTakvimUpdateInput = z.infer<typeof YillikTakvimUpdateSchema>

export const ChecklistCreateSchema = z.object({
  baslik: z.string().trim().min(1).max(300),
  aciklama: OptionalText(2000),
  sorumluEmail: z.string().trim().email().max(320).nullable().optional(),
  sonTarih: DateOnly.nullable().optional(),
  zorunlu: z.boolean().optional(),
  kanitGerekli: z.boolean().optional(),
}).strict()

export const ChecklistUpdateSchema = ChecklistCreateSchema.partial().extend({
  tamamlandi: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'En az bir alan gönderilmelidir')

export type ChecklistCreateInput = z.infer<typeof ChecklistCreateSchema>
export type ChecklistUpdateInput = z.infer<typeof ChecklistUpdateSchema>

export const YillikTakvimApprovalSchema = z.object({
  karar: z.nativeEnum(YillikTakvimOnayKarari),
  yorum: OptionalText(2000),
}).strict().superRefine((value, context) => {
  if (value.karar === 'REVIZYON_ISTENDI' && !value.yorum?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['yorum'], message: 'Revizyon gerekçesi zorunludur' })
  }
})

export function dateOnlyToUtc(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}
