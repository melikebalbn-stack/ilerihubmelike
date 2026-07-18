// Mesai performans endpoint'leri — ORTAK yetki/kapsam + tarih doğrulama yardımcıları.
// (Underscore prefix → Next route DEĞİL, sadece modül.) Ana /performans route deseniyle birebir.
import type { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { apiError } from '@/lib/api-response'
import { resolveAllowedDepts } from '@/lib/overtime-performance'

/**
 * Erişim kapısı: `overtime.report` izni VEYA dolu allowedDepts kapsamı (kendi bölümünün
 * sorumlusu/müdürü). İkisi de yoksa 403. Kapsam boş [] ama izinli → empty:true (noAccess).
 * Ana /api/overtime/performans route'unun deseniyle AYNEN.
 */
export type PerfScope =
  | { error: NextResponse }
  | { error: null; allowedDepts: string[] | undefined; empty: boolean }

export async function resolvePerfScope(): Promise<PerfScope> {
  const { session, user, error } = await requireUser()
  if (error) return { error }
  const allowedDepts = await resolveAllowedDepts(user.id)
  const hasReportPerm = session.user.permissions?.includes('overtime.report') ?? false
  const hasScope = allowedDepts === undefined || (Array.isArray(allowedDepts) && allowedDepts.length > 0)
  if (!hasReportPerm && !hasScope) {
    return { error: apiError('Mesai performans raporunu görüntüleme yetkiniz yok', 403) }
  }
  return { error: null, allowedDepts, empty: Array.isArray(allowedDepts) && allowedDepts.length === 0 }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** ISO YYYY-MM-DD → UTC gün başı Date; geçersizse null. */
export function parseIsoDateUTC(s: string | null): Date | null {
  if (!s || !ISO_DATE.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export const MAX_RANGE_DAYS = 366
/** from/to aralık doğrulaması. Hata mesajı döner; geçerliyse null. */
export function validateRange(from: Date, to: Date): string | null {
  if (from.getTime() > to.getTime()) return "'from' tarihi 'to'dan büyük olamaz"
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  if (days > MAX_RANGE_DAYS) return `Tarih aralığı en fazla ${MAX_RANGE_DAYS} gün olabilir (verilen: ${days})`
  return null
}
