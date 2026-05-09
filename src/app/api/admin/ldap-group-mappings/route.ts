import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'

/**
 * PR-Y4b: LDAP grup ↔ Role slug mapping yönetim endpoint'leri.
 * Permission: admin.system.manage (super-admin + admin + it-admin).
 */

/** GET — tüm mapping'ler + her biri için affected user count (User.groups'ta CN var mı). */
export async function GET() {
  const { session, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.system.manage')) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const mappings = await prisma.ldapGroupRoleMap.findMany({
    include: {
      role: { select: { id: true, slug: true, name: true } },
    },
    orderBy: [{ isActive: 'desc' }, { groupCN: 'asc' }],
  })

  // Affected user count per groupCN (User.groups @> [groupCN])
  // Tek raw sorguyla tüm CN'ler için sayılar — N+1 önlenir.
  const counts = await prisma.$queryRaw<
    Array<{ group_cn: string; user_count: bigint }>
  >`
    SELECT g AS group_cn, COUNT(*)::bigint AS user_count
    FROM "User", unnest(groups) AS g
    WHERE "isActive" = true
      AND g = ANY(${mappings.map((m) => m.groupCN)}::text[])
    GROUP BY g
  `
  const countByCN = new Map(counts.map((c) => [c.group_cn, Number(c.user_count)]))

  return NextResponse.json({
    mappings: mappings.map((m) => ({
      id: m.id,
      groupCN: m.groupCN,
      role: m.role,
      isActive: m.isActive,
      description: m.description,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      affectedUserCount: countByCN.get(m.groupCN) ?? 0,
    })),
  })
}

/** POST — yeni mapping oluştur. */
export async function POST(request: NextRequest) {
  const { session, user, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.system.manage')) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  let body: { groupCN?: unknown; roleId?: unknown; description?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const groupCN = typeof body.groupCN === 'string' ? body.groupCN.trim() : ''
  const roleId = typeof body.roleId === 'string' ? body.roleId.trim() : ''
  const description =
    typeof body.description === 'string' && body.description.trim().length > 0
      ? body.description.trim()
      : null

  if (!groupCN) {
    return NextResponse.json({ error: 'groupCN zorunlu' }, { status: 400 })
  }
  if (groupCN.length > 200) {
    return NextResponse.json({ error: 'groupCN çok uzun' }, { status: 400 })
  }
  if (!roleId) {
    return NextResponse.json({ error: 'roleId zorunlu' }, { status: 400 })
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, slug: true, name: true },
  })
  if (!role) {
    return NextResponse.json({ error: 'Role bulunamadı' }, { status: 404 })
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const mapping = await tx.ldapGroupRoleMap.create({
        data: { groupCN, roleId, description, isActive: true },
        include: { role: { select: { id: true, slug: true, name: true } } },
      })
      await tx.permissionAuditLog.create({
        data: {
          action: 'LDAP_GROUP_MAP_CREATED',
          actorId: user.id,
          targetType: 'LDAP_GROUP_MAP',
          targetId: mapping.id,
          details: {
            actorEmail: user.email,
            groupCN: mapping.groupCN,
            roleId: role.id,
            roleSlug: role.slug,
            roleName: role.name,
            description,
          },
        },
      })
      return mapping
    })

    return NextResponse.json({ mapping: created }, { status: 201 })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Bu groupCN için mapping zaten var' },
        { status: 409 }
      )
    }
    throw e
  }
}
