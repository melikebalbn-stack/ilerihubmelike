import { z } from 'zod'
import {
  YILLIK_TAKVIM_GERCEKLESME_DURUMLARI,
  YILLIK_TAKVIM_ONCELIKLERI,
  YILLIK_TAKVIM_PERIYOTLARI,
} from '@/components/sandbox/elif/takvim/types'

const DateInput = z.string().trim().min(1).refine(v => !Number.isNaN(Date.parse(v)), {
  message: 'Geçersiz tarih (ISO string bekleniyor, örn: "2026-06-15")',
})

export const YillikTakvimCreateSchema = z.object({
  yil: z.number().int().min(2000).max(2100),
  anaKonu: z.string().trim().min(1).max(300),
  surec: z.string().trim().min(1).max(300),
  departmentId: z.string().trim().min(1),
  anaSorumluUserId: z.string().trim().min(1),
  periyot: z.enum(YILLIK_TAKVIM_PERIYOTLARI),
  nihaiSonTarih: DateInput,
  kisaBaslik: z.string().trim().max(200).nullable().optional(),
  oncelik: z.enum(YILLIK_TAKVIM_ONCELIKLERI).optional(),
  aciklama: z.string().trim().max(5000).nullable().optional(),
  plananUygulamaTarihi: DateInput.nullable().optional(),
  gecerlilikBaslangici: DateInput.nullable().optional(),
  disKurum: z.string().trim().max(200).nullable().optional(),
  kanitZorunlu: z.boolean().optional(),
  gerceklesmeDurumu: z.enum(YILLIK_TAKVIM_GERCEKLESME_DURUMLARI).optional(),
  gerceklesmeTarihi: DateInput.nullable().optional(),
  gerceklesmemeNedeni: z.string().trim().max(2000).nullable().optional(),
})

export const YillikTakvimUpdateSchema = YillikTakvimCreateSchema.partial()

export const ChecklistCreateSchema = z.object({
  baslik: z.string().trim().min(1).max(300),
  aciklama: z.string().trim().max(2000).nullable().optional(),
  sorumluId: z.string().trim().min(1).nullable().optional(),
  sonTarih: DateInput.nullable().optional(),
  zorunlu: z.boolean().optional(),
  kanitGerekli: z.boolean().optional(),
})

export const ChecklistUpdateSchema = ChecklistCreateSchema.partial().extend({
  tamamlandi: z.boolean().optional(),
})

export const TamamlaSchema = z.object({
  aciklama: z.string().trim().max(2000).nullable().optional(),
})

export const OnaySchema = z.object({
  karar: z.enum(['ONAYLA', 'REVIZYON']),
  yorum: z.string().trim().max(2000).nullable().optional(),
})

export const SonrakiDonemSchema = z.object({
  nihaiSonTarih: DateInput.nullable().optional(),
  plananUygulamaTarihi: DateInput.nullable().optional(),
  gecerlilikBaslangici: DateInput.nullable().optional(),
  yil: z.number().int().min(2000).max(2100).optional(),
})
