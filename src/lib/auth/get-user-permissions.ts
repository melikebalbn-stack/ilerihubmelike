import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/**
 * Kullanıcının aktif (expiresAt geçmemiş) tüm rollerinden gelen permission key'leri döner.
 *
 * React.cache ile sarılı: aynı HTTP request içinde tekrar çağrılırsa DB'ye gitmez.
 * Permission değişimleri bir sonraki request'te hemen yansır (in-memory TTL cache yok).
 */
export const getUserPermissions = cache(async (userId: string): Promise<Set<string>> => {
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      role: {
        select: {
          rolePermissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
    },
  })

  const keys = new Set<string>()
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      keys.add(rp.permission.key)
    }
  }
  return keys
})

/**
 * Kullanıcının rollerini (slug + name) döner. UI'da "ben şu rollerdeyim" göstermek için.
 */
export const getUserRoles = cache(async (userId: string) => {
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      scope: true,
      source: true,
      role: { select: { id: true, slug: true, name: true, isSystem: true } },
    },
  })
  return userRoles.map(ur => ({
    id: ur.role.id,
    slug: ur.role.slug,
    name: ur.role.name,
    isSystem: ur.role.isSystem,
    scope: ur.scope,
    source: ur.source,
  }))
})
