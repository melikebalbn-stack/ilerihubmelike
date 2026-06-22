import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/ldap-group-mappings/preview
 *
 * Body: { email: string }
 *
 * Bir kullanıcının User.groups'una göre aktif mapping'lerle eşleşmesini
 * gösterir — gerçek sync'i tetiklemeden test etmek için.
 *
 * Response:
 *   - user (groups dahil)
 *   - matchingMappings: groupCN ↔ role pairs
 *   - wouldGetRoles: aktif mapping'lerin döktüğü role slug listesi
 *   - currentRoles: kullanıcının şu anki user_role kayıtları (source ile)
 *
 * NOT: Y4a sync mantığı manuel kayıtları DOKUNMUYOR; preview burada
 * "manuel + azure_ad" tüm role'leri ayırarak gösterir.
 */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission('admin.system.manage')
  if (error) return error

  let body: { email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) {
    return NextResponse.json({ error: 'email zorunlu' }, { status: 400 })
  }

  const target = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      name: true,
      groups: true,
      isActive: true,
      userRoles: {
        select: {
          source: true,
          role: { select: { id: true, slug: true, name: true } },
        },
      },
    },
  })

  if (!target) {
    return NextResponse.json({ error: 'User bulunamadı' }, { status: 404 })
  }

  const activeMappings = await prisma.ldapGroupRoleMap.findMany({
    where: { isActive: true, groupCN: { in: target.groups } },
    include: { role: { select: { id: true, slug: true, name: true } } },
  })

  const wouldGetRoleIds = new Set(activeMappings.map((m) => m.roleId))
  const currentRoleIds = new Set(target.userRoles.map((ur) => ur.role.id))

  return NextResponse.json({
    user: {
      id: target.id,
      email: target.email,
      name: target.name,
      isActive: target.isActive,
      groups: target.groups,
    },
    matchingMappings: activeMappings.map((m) => ({
      groupCN: m.groupCN,
      roleId: m.role.id,
      roleSlug: m.role.slug,
      roleName: m.role.name,
    })),
    wouldGetRoles: activeMappings.map((m) => ({
      slug: m.role.slug,
      name: m.role.name,
      // Mevcut manual kayıt varsa azure_ad insert atlanır → "alreadyHas" gösterir
      alreadyHas: currentRoleIds.has(m.role.id),
    })),
    currentRoles: target.userRoles.map((ur) => ({
      slug: ur.role.slug,
      name: ur.role.name,
      source: ur.source,
      // Bu role artık aktif mapping'e karşılık geliyor mu?
      stillMapped: wouldGetRoleIds.has(ur.role.id),
    })),
  })
}
