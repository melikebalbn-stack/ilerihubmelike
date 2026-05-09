import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { syncLDAPUsersToDb } from '@/lib/ldap-sync'

/**
 * POST /api/admin/ldap-group-mappings/trigger-sync
 *
 * Mapping değişikliği sonrası anında sync tetikler. Mevcut /api/admin/ldap-sync
 * ile aynı fonksiyonu çağırır — bu route Y4b mapping UI'sından doğrudan
 * "Şimdi Sync Et" butonu için kısayol; UX olarak ayrı bir endpoint olması
 * permission domain'i (admin.system.manage) ile tutarlı.
 */
export async function POST() {
  const { session, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.system.manage')) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const result = await syncLDAPUsersToDb()
  return NextResponse.json(result)
}
