import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
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
  const { error } = await requirePermission('admin.system.manage')
  if (error) return error

  const result = await syncLDAPUsersToDb()
  return NextResponse.json(result)
}
