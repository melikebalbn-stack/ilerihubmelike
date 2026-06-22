import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/permissions/matrix
 * 9 rol × 47 izin matrisi + meta. Tek request'te initial state.
 * SUPER_ADMIN-only.
 */
export async function GET() {
  const { session, user, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.roles.manage')) {
    return NextResponse.json(
      { error: 'İzin matrisi yönetimi için SUPER_ADMIN yetkisi gerekli' },
      { status: 403 }
    )
  }

  const [roles, permissions, rolePermissions] = await Promise.all([
    prisma.role.findMany({
      select: { id: true, slug: true, name: true, isSystem: true, isProtected: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    }),
    prisma.permission.findMany({
      select: { id: true, key: true, description: true, module: true },
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    }),
    prisma.rolePermission.findMany({
      select: { roleId: true, permissionId: true },
    }),
  ])

  const modules = Array.from(new Set(permissions.map((p) => p.module))).sort()
  const matrix: Record<string, string[]> = Object.fromEntries(roles.map((r) => [r.id, []]))
  for (const rp of rolePermissions) {
    if (matrix[rp.roleId]) matrix[rp.roleId].push(rp.permissionId)
  }

  return NextResponse.json({
    roles,
    permissions,
    modules,
    matrix,
    totals: {
      roles: roles.length,
      permissions: permissions.length,
      assignments: rolePermissions.length,
    },
  })
}

interface MatrixChange {
  roleId: string
  permissionId: string
  action: 'add' | 'remove'
}

/**
 * PATCH /api/permissions/matrix
 * Batch diff uygula. Tek transaction. Her değişiklik PermissionAuditLog'a yazılır.
 * SUPER_ADMIN-only. Body: { changes: MatrixChange[] } (max 500).
 *
 * Kurallar:
 * - SUPER_ADMIN rolünden izin çıkarılamaz (403)
 * - add idempotent (upsert), remove idempotent (deleteMany)
 * - Bilinmeyen rol/izin id → 400
 */
export async function PATCH(req: NextRequest) {
  const { session, user, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.roles.manage')) {
    return NextResponse.json(
      { error: 'İzin matrisi düzenleme için SUPER_ADMIN yetkisi gerekli' },
      { status: 403 }
    )
  }

  const body = (await req.json().catch(() => ({}))) as { changes?: unknown }
  const rawChanges = Array.isArray(body.changes) ? body.changes : []

  if (rawChanges.length === 0) {
    return NextResponse.json({ error: 'Değişiklik bulunamadı' }, { status: 400 })
  }
  if (rawChanges.length > 500) {
    return NextResponse.json(
      { error: 'Tek seferde en fazla 500 değişiklik gönderilebilir' },
      { status: 400 }
    )
  }

  const changes: MatrixChange[] = []
  for (const c of rawChanges) {
    if (
      !c ||
      typeof c !== 'object' ||
      typeof (c as MatrixChange).roleId !== 'string' ||
      typeof (c as MatrixChange).permissionId !== 'string' ||
      ((c as MatrixChange).action !== 'add' && (c as MatrixChange).action !== 'remove')
    ) {
      return NextResponse.json(
        { error: 'Geçersiz değişiklik formatı' },
        { status: 400 }
      )
    }
    changes.push(c as MatrixChange)
  }

  const roleIds = Array.from(new Set(changes.map((c) => c.roleId)))
  const permissionIds = Array.from(new Set(changes.map((c) => c.permissionId)))

  const [validRoles, validPermissions] = await Promise.all([
    prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, slug: true, name: true },
    }),
    prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true, key: true, module: true },
    }),
  ])

  if (validRoles.length !== roleIds.length || validPermissions.length !== permissionIds.length) {
    return NextResponse.json(
      { error: 'Geçersiz rol veya izin ID' },
      { status: 400 }
    )
  }

  const roleById = new Map(validRoles.map((r) => [r.id, r]))
  const permById = new Map(validPermissions.map((p) => [p.id, p]))

  const superAdmin = validRoles.find((r) => r.slug === 'super-admin')
  if (superAdmin) {
    const violation = changes.find(
      (c) => c.roleId === superAdmin.id && c.action === 'remove'
    )
    if (violation) {
      return NextResponse.json(
        { error: 'Super Admin rolünden izin çıkarılamaz — sistem bütünlüğü için kilitli' },
        { status: 403 }
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const c of changes) {
      if (c.action === 'add') {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: c.roleId, permissionId: c.permissionId },
          },
          create: {
            roleId: c.roleId,
            permissionId: c.permissionId,
            grantedById: user.id,
          },
          update: {},
        })
      } else {
        await tx.rolePermission.deleteMany({
          where: { roleId: c.roleId, permissionId: c.permissionId },
        })
      }
    }

    await tx.permissionAuditLog.createMany({
      data: changes.map((c) => {
        const role = roleById.get(c.roleId)!
        const perm = permById.get(c.permissionId)!
        return {
          action: c.action === 'add' ? 'PERMISSION_GRANTED' : 'PERMISSION_REVOKED',
          actorId: user.id,
          targetType: 'ROLE',
          targetId: c.roleId,
          details: {
            actorEmail: user.email,
            roleSlug: role.slug,
            roleName: role.name,
            permissionKey: perm.key,
            permissionModule: perm.module,
          },
        }
      }),
    })
  })

  return NextResponse.json({
    success: true,
    applied: changes.length,
    message: `${changes.length} değişiklik kaydedildi`,
  })
}
