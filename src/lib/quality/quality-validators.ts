/**
 * Quality module Zod validators (KALITE-2)
 *
 * Client'a Decimal'lar **string** olarak gönder/al (precision korunması için).
 */

import { z } from 'zod'

// Decimal stringi: "34", "34.5", "34,5" — virgül veya nokta, opsiyonel işaret
const DecimalString = z
  .string()
  .trim()
  .min(1)
  .refine(
    (v) => /^-?\d+([.,]\d+)?$/.test(v),
    { message: 'Geçersiz sayı formatı (Decimal string bekleniyor, örn: "34.5")' },
  )

// ════════════════════════════════════════════════════════════
// TEMPLATE
// ════════════════════════════════════════════════════════════

export const TemplateCharSchema = z.object({
  orderIndex: z.number().int().min(1),
  department: z.string().nullable().optional(),
  inspectionTool: z.string().nullable().optional(),
  sampleFreq: z.string().nullable().optional(),
  critical: z.boolean().optional().default(false),
  symbolId: z.string().min(1).nullable().optional(),
  charName: z.string().min(1).max(200),
  nominal: DecimalString.nullable().optional(),
  maxValue: DecimalString.nullable().optional(),
  minValue: DecimalString.nullable().optional(),
  hasNumericRange: z.boolean().optional().default(true),
  // GD&T datum referansları — kısa etiket (örn. "A", "B", "Ø9.9")
  datum1: z.string().trim().max(32).nullable().optional(),
  datum2: z.string().trim().max(32).nullable().optional(),
  datum3: z.string().trim().max(32).nullable().optional(),
})

export const TemplateUpsertSchema = z.object({
  formNo: z.string().min(1).max(50),
  partName: z.string().min(1).max(200),
  drawingNo: z.string().min(1).max(50),
  revision: z.string().min(1).max(20),
  department: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  characteristics: z.array(TemplateCharSchema).min(1).max(50),
})

export const TemplatePatchSchema = TemplateUpsertSchema.partial().extend({
  // characteristics PATCH'te VERILEN ise full replace; verilmemişse dokunulmaz
  characteristics: z.array(TemplateCharSchema).min(1).max(50).optional(),
})

// ════════════════════════════════════════════════════════════
// REPORT
// ════════════════════════════════════════════════════════════

export const ReportCreateSchema = z.object({
  templateId: z.string().min(1),
  operatorNo: z.string().nullable().optional(),
  lotNo: z.string().nullable().optional(),
  orderQty: z.number().int().positive().nullable().optional(),
  machine: z.string().nullable().optional(),
  gaugeNo: z.string().nullable().optional(),
  escalationContact: z.string().nullable().optional(),
  measurementDate: z.string().datetime().nullable().optional(),
})

export const ReportPatchSchema = z.object({
  operatorNo: z.string().nullable().optional(),
  lotNo: z.string().nullable().optional(),
  orderQty: z.number().int().positive().nullable().optional(),
  machine: z.string().nullable().optional(),
  gaugeNo: z.string().nullable().optional(),
  escalationContact: z.string().nullable().optional(),
  measurementDate: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  controllerOpNo: z.string().nullable().optional(),
})

// 10 element; her biri Decimal string veya null/empty
export const MeasurementsSchema = z
  .array(z.union([DecimalString, z.literal(''), z.null()]))
  .length(10)

export const CharUpdateSchema = z.object({
  measurements: MeasurementsSchema,
})

// ════════════════════════════════════════════════════════════
// SYMBOL (KALITE-6)
// ════════════════════════════════════════════════════════════

// key: lowercase, alfanümerik + '-' / '_'; 1–48 karakter
const SymbolKey = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9_-]+$/, { message: 'Yalnızca küçük harf, rakam, _ ve - kullanılabilir' })

const SymbolName = z.string().trim().min(1).max(120)
const SymbolSvg = z.string().trim().min(1).max(8000)
const SymbolOrder = z.number().int().min(0).max(9999)

export const SymbolCreateSchema = z.object({
  key: SymbolKey,
  nameTr: SymbolName,
  nameEn: SymbolName,
  svgContent: SymbolSvg,
  displayOrder: SymbolOrder.optional(),
})

/** PATCH — tüm alanlar opsiyonel. System sembol koruması route'ta enforce edilir. */
export const SymbolPatchSchema = z.object({
  nameTr: SymbolName.optional(),
  nameEn: SymbolName.optional(),
  svgContent: SymbolSvg.optional(),
  displayOrder: SymbolOrder.optional(),
  active: z.boolean().optional(),
})

// ════════════════════════════════════════════════════════════
// Type exports
// ════════════════════════════════════════════════════════════

export type TemplateCharInput = z.infer<typeof TemplateCharSchema>
export type TemplateUpsertInput = z.infer<typeof TemplateUpsertSchema>
export type TemplatePatchInput = z.infer<typeof TemplatePatchSchema>
export type ReportCreateInput = z.infer<typeof ReportCreateSchema>
export type ReportPatchInput = z.infer<typeof ReportPatchSchema>
export type CharUpdateInput = z.infer<typeof CharUpdateSchema>
export type SymbolCreateInput = z.infer<typeof SymbolCreateSchema>
export type SymbolPatchInput = z.infer<typeof SymbolPatchSchema>
