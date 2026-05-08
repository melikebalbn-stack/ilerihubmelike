import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserPermissions, getUserRoles } from '@/lib/auth/get-user-permissions'

/**
 * Aktif kullanıcının yetki ve rollerini döner.
 * Geliştirme amaçlı doğrulama endpoint'i. PR-Y3 admin paneli de bunu kullanabilir.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const [perms, roles] = await Promise.all([
    getUserPermissions(session.user.id),
    getUserRoles(session.user.id),
  ])

  const dbSorted = [...perms].sort()
  const sessSorted = [...(session.user.permissions ?? [])].sort()

  return NextResponse.json({
    userId: session.user.id,
    email: session.user.email,
    roles,
    permissions: dbSorted,
    permissionCount: perms.size,
    sessionPermissions: session.user.permissions ?? [],
    sessionPermissionCount: session.user.permissions?.length ?? 0,
    syncMatch: JSON.stringify(dbSorted) === JSON.stringify(sessSorted),
  })
}
