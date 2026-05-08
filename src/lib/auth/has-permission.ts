import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserPermissions } from './get-user-permissions'

/**
 * Aktif kullanıcının verilen permission'a sahip olup olmadığını söyler.
 * Server component, server action ve API route'larda kullanılır.
 *
 * Session yoksa false döner (login değil).
 *
 * Çoklu permission verirsen (array): herhangi birine sahipse true (OR mantığı).
 */
export async function hasPermission(
  permissionKey: string | string[],
): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false

  const userPerms = await getUserPermissions(session.user.id)
  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey]
  return keys.some(k => userPerms.has(k))
}

/**
 * Tüm permission'lara sahip mi? (AND mantığı)
 */
export async function hasAllPermissions(permissionKeys: string[]): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false

  const userPerms = await getUserPermissions(session.user.id)
  return permissionKeys.every(k => userPerms.has(k))
}
