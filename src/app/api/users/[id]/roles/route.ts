import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/users/[id]/roles
 * Set-replace manuel rol listesi. Azure AD rolleri DOKUNULMAZ.
 * SUPER_ADMIN-only.
 *
 * Body: { roleIds: string[] } — manuel rollerin tam yeni listesi
 *
 * Davranış:
 * - source='manual' UserRole kayıtları silinir, yeni roleIds ile yeniden oluşturulur
 * - source='azure_ad' UserRole kayıtları DOKUNULMAZ (LDAP sync override koruması)
 * - Eklenen + kaldırılan her rol için PermissionAuditLog (USER_ROLE_GRANTED/REVOKED)
 * - prisma.$transaction ile atomik
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireUser()
  if (error) return error
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Kullanıcı rol yönetimi için SUPER_ADMIN yetkisi gerekli' },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { roleIds?: unknown }
  const newRoleIds: string[] = Array.isArray(body.roleIds)
    ? (body.roleIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : []

  if (!Array.isArray(body.roleIds) || newRoleIds.length !== (body.roleIds as unknown[]).length) {
    return NextResponse.json({ error: 'Geçersiz roleIds formatı' }, { status: 400 })
  }
  if (newRoleIds.length > 9) {
    return NextResponse.json(
      { error: 'Bir kullanıcıya en fazla 9 rol atanabilir' },
      { status: 400 }
    )
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      userRoles: { select: { roleId: true, source: true } },
    },
  })
  if (!targetUser) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
  }
  if (!targetUser.isActive) {
    return NextResponse.json(
      { error: 'Pasif kullanıcıya rol atanamaz' },
      { status: 400 }
    )
  }

  const validRoles = newRoleIds.length
    ? await prisma.role.findMany({
        where: { id: { in: newRoleIds } },
        select: { id: true, slug: true, name: true },
      })
    : []

  if (validRoles.length !== newRoleIds.length) {
    return NextResponse.json({ error: 'Geçersiz rol ID' }, { status: 400 })
  }

  const currentManualRoleIds = targetUser.userRoles
    .filter((ur) => ur.source === 'manual')
    .map((ur) => ur.roleId)

  const newSet = new Set(newRoleIds)
  const currSet = new Set(currentManualRoleIds)
  const toAdd = newRoleIds.filter((rid) => !currSet.has(rid))
  const toRemove = currentManualRoleIds.filter((rid) => !newSet.has(rid))

  if (toAdd.length === 0 && toRemove.length === 0) {
    return NextResponse.json({
      success: true,
      changes: { added: 0, removed: 0 },
      message: 'Değişiklik yok',
    })
  }

  const allTouchedRoleIds = Array.from(new Set([...toAdd, ...toRemove]))
  const allTouchedRoles = await prisma.role.findMany({
    where: { id: { in: allTouchedRoleIds } },
    select: { id: true, slug: true, name: true },
  })
  const touchedRoleById = new Map(allTouchedRoles.map((r) => [r.id, r]))

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({
      where: { userId: id, source: 'manual' },
    })

    if (newRoleIds.length > 0) {
      await tx.userRole.createMany({
        data: newRoleIds.map((roleId) => ({
          userId: id,
          roleId,
          source: 'manual',
          assignedById: user.id,
        })),
        skipDuplicates: true,
      })
    }

    const auditEntries = [
      ...toAdd.map((rid) => {
        const role = touchedRoleById.get(rid)!
        return {
          action: 'USER_ROLE_GRANTED',
          actorId: user.id,
          targetType: 'USER',
          targetId: id,
          details: {
            actorEmail: user.email,
            targetUserEmail: targetUser.email,
            targetUserName: targetUser.name,
            roleId: rid,
            roleSlug: role.slug,
            roleName: role.name,
          },
        }
      }),
      ...toRemove.map((rid) => {
        const role = touchedRoleById.get(rid)!
        return {
          action: 'USER_ROLE_REVOKED',
          actorId: user.id,
          targetType: 'USER',
          targetId: id,
          details: {
            actorEmail: user.email,
            targetUserEmail: targetUser.email,
            targetUserName: targetUser.name,
            roleId: rid,
            roleSlug: role.slug,
            roleName: role.name,
          },
        }
      }),
    ]

    if (auditEntries.length > 0) {
      await tx.permissionAuditLog.createMany({ data: auditEntries })
    }
  })

  return NextResponse.json({
    success: true,
    changes: { added: toAdd.length, removed: toRemove.length },
    message: `${toAdd.length + toRemove.length} değişiklik kaydedildi`,
  })
}
