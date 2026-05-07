// BGYS (Bilgi Güvenliği Yönetim Sistemi) yetki kontrolü
// ISO 27001 modüllerinde kullanılan ortak helper

import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { User } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'

// Role enum (Role): SUPER_ADMIN, ADMIN, HR_MANAGER, QUALITY_MANAGER,
// IT_MANAGER, DEPT_HEAD, SUPERVISOR, EMPLOYEE
// BGYS_SORUMLUSU rolü henüz Role enum'da yok — IT_MANAGER + ADMIN setiyle
// kapsayıp ayrıca email allowlist'i destekliyoruz.
const BGYS_ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'IT_MANAGER',
  'QUALITY_MANAGER',
] as const

// BGYS sorumluluğu rol-bazlı değil, kişi-bazlı verilebilir.
// Sistem Geliştirme Mühendisi gibi BGYS işini yürüten ama Role enum'da
// IT_MANAGER olmayan kullanıcılar için.
// PR-EMAIL-NORMALIZE sonrası tüm DB email'ler lowercase, bu liste de lowercase.
const BGYS_ALLOWED_EMAILS = [
  'melike.balaban@ilerigroup.com',
  'melih.dilben@ilerigroup.com',
]

export type RequireBgysSorumluResult =
  | { session: Session; user: User; error: null }
  | { session: null; user: null; error: NextResponse }

/**
 * BGYS Sorumlusu auth helper.
 *
 * - Önce requireUser ile auth + DB user lookup yapar (id-based, casing-safe)
 * - Sonra rol VEYA hardcoded email listesi kontrolü
 *
 * Caller pattern (PR-Y2.5 standard):
 *   const { user, error } = await requireBgysSorumlu()
 *   if (error) return error
 *   // user.role, user.email DB'den taze (PR-EMAIL-NORMALIZE sonrası lowercase)
 */
export async function requireBgysSorumlu(): Promise<RequireBgysSorumluResult> {
  const result = await requireUser()
  if (result.error) {
    return { session: null, user: null, error: result.error }
  }
  const { session, user } = result

  const isAllowedRole = (BGYS_ALLOWED_ROLES as readonly string[]).includes(user.role)
  const isAllowedEmail = BGYS_ALLOWED_EMAILS.includes(user.email)

  if (!isAllowedRole && !isAllowedEmail) {
    return {
      session: null,
      user: null,
      error: NextResponse.json(
        { error: 'Bu işlem için BGYS yetkisi gereklidir' },
        { status: 403 }
      ),
    }
  }

  return { session, user, error: null }
}

/**
 * Synchronous BGYS check (mevcut session/user objesi varsa).
 * Helper olmayan kontekstler için (örn. UI conditional render).
 */
export function isBgysSorumlu(
  email: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!email) return false
  const normalized = email.toLowerCase()
  if (BGYS_ALLOWED_EMAILS.includes(normalized)) return true
  return (BGYS_ALLOWED_ROLES as readonly string[]).includes(role ?? '')
}
