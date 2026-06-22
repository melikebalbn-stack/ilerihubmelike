import { cache } from 'react'
import type { Session } from 'next-auth'
import type { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { User } from '@/generated/prisma'
import { apiUnauthorized } from '@/lib/api-response'
import { requireSession } from './require-session'

/**
 * PR-Y2.5: Auth + DB user lookup helper.
 *
 * Aynı request içinde birden fazla çağrı yapılırsa React cache() ile
 * tek findUnique yapılır (dedupe).
 *
 * Pattern:
 *   const { user, error } = await requireUser()
 *   if (error) return error
 *   // user.id, user.email (DB casing), user.role, user.isActive vs.
 *
 * isActive=false kullanıcı 401 alır (oturum açabilse bile pasif kullanıcı
 * API'lere erişemez).
 */
export type RequireUserResult =
  | { session: Session; user: User; error: null }
  | { session: null; user: null; error: NextResponse }

// Aynı request içinde dedupe — birden çok endpoint helper'ı çağırırsa
// tek DB hit'le çözülür.
const cachedUserLookup = cache(async (userId: string) => {
  return prisma.user.findUnique({ where: { id: userId } })
})

export async function requireUser(): Promise<RequireUserResult> {
  const sessionResult = await requireSession()
  if (sessionResult.error) {
    return { session: null, user: null, error: sessionResult.error }
  }

  const user = await cachedUserLookup(sessionResult.userId)
  if (!user || !user.isActive) {
    return { session: null, user: null, error: apiUnauthorized() }
  }

  return { session: sessionResult.session, user, error: null }
}
