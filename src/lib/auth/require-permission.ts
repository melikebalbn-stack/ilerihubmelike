import { NextResponse } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserPermissions } from './get-user-permissions'

interface PermissionGuardSuccess {
  session: Session
  userId: string
  error: null
}
interface PermissionGuardFailure {
  session: null
  userId: null
  error: NextResponse
}
type PermissionGuardResult = PermissionGuardSuccess | PermissionGuardFailure

/**
 * API route guard. Kullanılışı:
 *
 *   const { session, error } = await requirePermission('akademi.admin')
 *   if (error) return error
 *   // ... session.user.id kullanılabilir
 *
 * Çoklu permission: ['izin.approve', 'izin.admin'] → herhangi biri yeterli (OR)
 */
export async function requirePermission(
  permissionKey: string | string[],
): Promise<PermissionGuardResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return {
      session: null,
      userId: null,
      error: NextResponse.json(
        { error: 'Yetkisiz: oturum bulunamadı' },
        { status: 401 },
      ),
    }
  }

  const userPerms = await getUserPermissions(session.user.id)
  const required = Array.isArray(permissionKey) ? permissionKey : [permissionKey]
  const ok = required.some(k => userPerms.has(k))

  if (!ok) {
    return {
      session: null,
      userId: null,
      error: NextResponse.json(
        { error: 'Yetersiz yetki', required },
        { status: 403 },
      ),
    }
  }

  return { session, userId: session.user.id, error: null }
}

/**
 * Tüm permission'lar gerekli (AND mantığı).
 */
export async function requireAllPermissions(
  permissionKeys: string[],
): Promise<PermissionGuardResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return {
      session: null,
      userId: null,
      error: NextResponse.json({ error: 'Yetkisiz: oturum bulunamadı' }, { status: 401 }),
    }
  }

  const userPerms = await getUserPermissions(session.user.id)
  const missing = permissionKeys.filter(k => !userPerms.has(k))

  if (missing.length > 0) {
    return {
      session: null,
      userId: null,
      error: NextResponse.json(
        { error: 'Yetersiz yetki', missing },
        { status: 403 },
      ),
    }
  }

  return { session, userId: session.user.id, error: null }
}
