/**
 * Offboarding module Zod validators (OFFB-2)
 *
 * KALITE-2 quality-validators stiliyle uyumlu. Tarih alanları @db.Date —
 * input ISO string (tam datetime VEYA 'YYYY-MM-DD') kabul edilir, route'ta
 * new Date(...) ile Date'e çevrilir.
 */

import { z } from 'zod'
import {
  OffboardingPersonnelType,
  OffboardingSeparationType,
  OffboardingStatus,
} from '@/generated/prisma'

// ISO tarih (tam datetime veya date-only). @db.Date alanları için yeterli.
const DateInput = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'Geçersiz tarih (ISO string bekleniyor, örn: "2026-06-15")',
  })

// ════════════════════════════════════════════════════════════
// CREATE
// ════════════════════════════════════════════════════════════

export const OffboardingCreateSchema = z.object({
  adSoyad: z.string().trim().min(1).max(200),
  sicilNo: z.string().trim().max(50).nullable().optional(),
  departman: z.string().trim().max(200).nullable().optional(),
  gorev: z.string().trim().max(200).nullable().optional(),
  iseGirisTarihi: DateInput.nullable().optional(),
  ayrilisTarihi: DateInput,
  personelTuru: z.nativeEnum(OffboardingPersonnelType),
  ayrilisTuru: z.nativeEnum(OffboardingSeparationType),
  personnelId: z.string().min(1).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// ════════════════════════════════════════════════════════════
// PATCH (header + item güncellemeleri)
// ════════════════════════════════════════════════════════════

export const OffboardingAssetItemPatchSchema = z.object({
  id: z.string().min(1),
  returned: z.boolean().optional(),
  notApplicable: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
})

export const OffboardingAccessItemPatchSchema = z.object({
  id: z.string().min(1),
  revoked: z.boolean().optional(),
  revokedAt: DateInput.nullable().optional(),
  appliedBy: z.string().trim().max(200).nullable().optional(),
})

export const OffboardingPatchSchema = z
  .object({
    // Header
    adSoyad: z.string().trim().min(1).max(200).optional(),
    sicilNo: z.string().trim().max(50).nullable().optional(),
    departman: z.string().trim().max(200).nullable().optional(),
    gorev: z.string().trim().max(200).nullable().optional(),
    iseGirisTarihi: DateInput.nullable().optional(),
    ayrilisTarihi: DateInput.optional(),
    personelTuru: z.nativeEnum(OffboardingPersonnelType).optional(),
    ayrilisTuru: z.nativeEnum(OffboardingSeparationType).optional(),
    personnelId: z.string().min(1).nullable().optional(),
    teslimEdenAd: z.string().trim().max(200).nullable().optional(),
    teslimAlanId: z.string().min(1).nullable().optional(),
    beyanOnay: z.boolean().optional(),
    notes: z.string().max(5000).nullable().optional(),
    status: z.nativeEnum(OffboardingStatus).optional(),
    // Item güncellemeleri (verilen id'ler bu forma ait olmalı — route doğrular)
    assetItems: z.array(OffboardingAssetItemPatchSchema).max(50).optional(),
    accessItems: z.array(OffboardingAccessItemPatchSchema).max(50).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: 'En az bir alan gönderilmeli',
  })

// ════════════════════════════════════════════════════════════
// APPROVE
// ════════════════════════════════════════════════════════════

/** Hangi onay alanına acting user'ın DB id'si yazılacak. */
export const OffboardingApproveSchema = z.object({
  field: z.enum(['hazirlayanId', 'onaylayan1Id', 'onaylayan2Id']),
})

// ════════════════════════════════════════════════════════════
// Durum geçişi (DRAFT → IN_PROGRESS → COMPLETED)
// ════════════════════════════════════════════════════════════

const STATUS_ORDER: Record<OffboardingStatus, number> = {
  DRAFT: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
}

/**
 * Yalnız ileri tek-adım geçiş geçerli (DRAFT→IN_PROGRESS, IN_PROGRESS→COMPLETED)
 * veya aynı duruma no-op. Geri ve atlama (DRAFT→COMPLETED) geçişleri reddedilir.
 */
export function isValidStatusTransition(
  from: OffboardingStatus,
  to: OffboardingStatus,
): boolean {
  if (from === to) return true
  return STATUS_ORDER[to] === STATUS_ORDER[from] + 1
}

/**
 * COMPLETED için minimum koşul: beyan onayı + en az hazırlayan ve 1. onaylayan.
 * (KALITE-2 finalize'ın "karakteristik mevcut" ön-koşuluna analog.)
 */
export function canComplete(form: {
  beyanOnay: boolean
  hazirlayanId: string | null
  onaylayan1Id: string | null
}): boolean {
  return form.beyanOnay && !!form.hazirlayanId && !!form.onaylayan1Id
}

// ════════════════════════════════════════════════════════════
// Type exports
// ════════════════════════════════════════════════════════════

export type OffboardingCreateInput = z.infer<typeof OffboardingCreateSchema>
export type OffboardingPatchInput = z.infer<typeof OffboardingPatchSchema>
export type OffboardingApproveInput = z.infer<typeof OffboardingApproveSchema>
