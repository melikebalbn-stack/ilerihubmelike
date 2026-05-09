import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/roles
 * RBAC yönetim arayüzünün rol listesi (PR-Y3a). SUPER_ADMIN-only.
 * Her rol için kullanıcı ve permission sayısı döner.
 */
export async function GET() {
  const { session, user, error } = await requireUser()
  if (error) return error

  if (!session.user.permissions?.includes('admin.roles.manage')) {
    return NextResponse.json(
      { error: 'Rol yönetimi için SUPER_ADMIN yetkisi gerekli' },
      { status: 403 }
    )
  }

  const roles = await prisma.role.findMany({
    include: {
      _count: {
        select: {
          userRoles: true,
          rolePermissions: true,
        },
      },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json({
    roles: roles.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isProtected: r.isProtected,
      userCount: r._count.userRoles,
      permissionCount: r._count.rolePermissions,
      createdAt: r.createdAt,
    })),
  })
}
