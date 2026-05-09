import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncLDAPUsersToDb } from '@/lib/ldap-sync'

/**
 * POST /api/admin/ldap-sync
 * LDAP'daki tüm aktif kullanıcıları DB'ye senkronize eder.
 * Sadece ADMIN ve SUPER_ADMIN erişebilir.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // PR-Y13: enum check yerine RBAC permission.
    // admin.system.manage → admin, it-admin, super-admin
    if (!session.user.permissions?.includes('admin.system.manage')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const result = await syncLDAPUsersToDb()

    return NextResponse.json(result)
  } catch (error) {
    console.error('[LDAP-SYNC] API error:', error)
    return NextResponse.json(
      { error: 'LDAP senkronizasyonu sırasında hata oluştu' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/ldap-sync
 * Son sync durumunu döndürür.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // PR-Y13: enum check yerine RBAC permission.
    // admin.system.manage → admin, it-admin, super-admin
    if (!session.user.permissions?.includes('admin.system.manage')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { getLastSyncStatus } = await import('@/lib/ldap-sync')
    const status = getLastSyncStatus()

    return NextResponse.json(status)
  } catch (error) {
    console.error('[LDAP-SYNC] Status error:', error)
    return NextResponse.json(
      { error: 'Sync durumu alınamadı' },
      { status: 500 }
    )
  }
}
