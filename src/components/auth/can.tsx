'use client'

import { useSession } from 'next-auth/react'
import { ReactNode } from 'react'

interface CanProps {
  permission: string | string[]
  /** AND mantığı: tüm permission'lar gerekli (default: false = OR) */
  all?: boolean
  children: ReactNode
  /** Yetkisi yoksa gösterilecek alternatif (default: null) */
  fallback?: ReactNode
}

/**
 * Koşullu UI render. Session'daki `permissions` array'ine bakar.
 *
 * Kullanım:
 *   <Can permission="akademi.admin">
 *     <Button>Kurs Düzenle</Button>
 *   </Can>
 *
 *   <Can permission={['izin.approve', 'izin.admin']}>...</Can>
 */
export function Can({ permission, all = false, children, fallback = null }: CanProps) {
  const { data: session } = useSession()
  const userPerms = (session?.user?.permissions ?? []) as string[]

  const required = Array.isArray(permission) ? permission : [permission]
  const allowed = all
    ? required.every(k => userPerms.includes(k))
    : required.some(k => userPerms.includes(k))

  return <>{allowed ? children : fallback}</>
}

/**
 * Hook versiyonu. Karmaşık koşullar için.
 */
export function useHasPermission(permission: string | string[], all = false): boolean {
  const { data: session } = useSession()
  const userPerms = (session?.user?.permissions ?? []) as string[]
  const required = Array.isArray(permission) ? permission : [permission]
  return all
    ? required.every(k => userPerms.includes(k))
    : required.some(k => userPerms.includes(k))
}
