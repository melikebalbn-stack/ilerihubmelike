// BGYS (Bilgi Güvenliği Yönetim Sistemi) yetki kontrolü
// ISO 27001 modüllerinde kullanılan ortak helper

import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
const BGYS_ALLOWED_EMAILS = [
  'melike.balaban@ilerigroup.com',
  'melih.dilben@ilerigroup.com',
]

export async function requireBgysSorumlu(): Promise<{
  session: Session | null
  error: NextResponse | null
}> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const role = (session.user as { role?: string }).role ?? ''
  const email = session.user.email.toLowerCase()

  const hasRole = (BGYS_ALLOWED_ROLES as readonly string[]).includes(role)
  const inAllowlist = BGYS_ALLOWED_EMAILS.includes(email)

  if (!hasRole && !inAllowlist) {
    return {
      session,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

export function isBgysSorumlu(
  email: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!email) return false
  const normalized = email.toLowerCase()
  if (BGYS_ALLOWED_EMAILS.includes(normalized)) return true
  return (BGYS_ALLOWED_ROLES as readonly string[]).includes(role ?? '')
}
