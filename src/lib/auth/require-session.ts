import { getServerSession, type Session } from 'next-auth'
import type { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { apiUnauthorized } from '@/lib/api-response'

/**
 * PR-Y2.5: Auth lookup helper — sadece session + userId.
 *
 * DB hit YAPMAZ. Performans-kritik veya sadece session.user metadata'sı
 * yeterli olan endpoint'ler için kullan.
 *
 * Eğer DB user objesi (örn. user.role, user.email DB casing, user.isActive)
 * gerekliyse `requireUser()` kullan.
 *
 * Pattern (akademi `requireAkademiAdmin` ile uyumlu):
 *   const { session, userId, error } = await requireSession()
 *   if (error) return error
 *
 * PR-Y1+Y2 sonrası: session.user.id auth.ts session callback'inde set ediliyor.
 * PR-NTF-FIX (ae35cfc, 6 May 2026) ile email-based lookup'ın LDAP email-casing
 * mismatch bug'ı tespit edildi. Bu helper id-based pattern'i standartlaştırıyor.
 */
export type RequireSessionResult =
  | { session: Session; userId: string; error: null }
  | { session: null; userId: null; error: NextResponse }

export async function requireSession(): Promise<RequireSessionResult> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!session || !userId) {
    return { session: null, userId: null, error: apiUnauthorized() }
  }
  return { session, userId, error: null }
}
