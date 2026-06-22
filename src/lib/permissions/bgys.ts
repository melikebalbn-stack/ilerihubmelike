// BGYS (Bilgi Güvenliği Yönetim Sistemi) yetki kontrolü
// ISO 27001 modüllerinde kullanılan ortak helper

import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { User } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'

/**
 * PR-Y12 öncesi pattern: enum + hardcoded email allowlist.
 * Şu an: saf RBAC. bgys-sorumlusu slug'ında olan + super-admin geçer.
 *
 * Y3a sırasında bgys-sorumlusu slug'ı oluşturuldu ve Melih + Melike'ye
 * atandı. Hardcoded email + enum legacy fallback artık gerekmiyor —
 * tüm aktif BGYS kullanıcıları zaten bgys-sorumlusu+super-admin slug'ında.
 *
 * Y3c matrisinde bgys.audit.manage permission'ı bgys-sorumlusu + super-admin'de.
 * Bu permission "BGYS Sorumlusu yetkisi" semantiğini temsil eder (en üst yetki —
 * doküman approve, risk yönetimi, audit yönetimi hep bunu içerir).
 */

export type RequireBgysSorumluResult =
  | { session: Session; user: User; error: null }
  | { session: null; user: null; error: NextResponse }

/**
 * BGYS Sorumlusu auth helper (server).
 *
 * Saf RBAC: bgys.audit.manage permission'ı kontrol edilir.
 *
 * Caller pattern (Y2.5 standard, imza KORUNDU):
 *   const { session, user, error } = await requireBgysSorumlu()
 *   if (error) return error
 */
export async function requireBgysSorumlu(): Promise<RequireBgysSorumluResult> {
  const result = await requireUser()
  if (result.error) {
    return { session: null, user: null, error: result.error }
  }
  const { session, user } = result

  if (!session.user.permissions?.includes('bgys.audit.manage')) {
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
 * Synchronous BGYS check (frontend conditional render için).
 *
 * PR-Y12 sonrası imza değişti: (email, role) → (permissions).
 * Eski tüketici (documents/page.tsx) bu PR'da güncellendi.
 */
export function isBgysSorumlu(permissions?: string[] | null): boolean {
  return permissions?.includes('bgys.audit.manage') ?? false
}
