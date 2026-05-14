import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'

/** PATCH — mevcut mapping güncelle (role, isActive, description). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) return error
  const actorId = session.user.id
  const actorEmail = session.user.email

  const { id } = await params

  let body: { roleId?: unknown; isActive?: unknown; description?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const existing = await prisma.ldapGroupRoleMap.findUnique({
    where: { id },
    include: { role: { select: { id: true, slug: true, name: true } } },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Mapping bulunamadı' }, { status: 404 })
  }

  const updateData: {
    roleId?: string
    isActive?: boolean
    description?: string | null
  } = {}

  let newRole = existing.role
  if (typeof body.roleId === 'string' && body.roleId.trim().length > 0) {
    if (body.roleId !== existing.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: body.roleId },
        select: { id: true, slug: true, name: true },
      })
      if (!role) {
        return NextResponse.json({ error: 'Role bulunamadı' }, { status: 404 })
      }
      updateData.roleId = role.id
      newRole = role
    }
  }
  if (typeof body.isActive === 'boolean') {
    updateData.isActive = body.isActive
  }
  if (body.description !== undefined) {
    updateData.description =
      typeof body.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'Güncellenecek alan yok' },
      { status: 400 }
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.ldapGroupRoleMap.update({
      where: { id },
      data: updateData,
      include: { role: { select: { id: true, slug: true, name: true } } },
    })
    await tx.permissionAuditLog.create({
      data: {
        action: 'LDAP_GROUP_MAP_UPDATED',
        actorId,
        targetType: 'LDAP_GROUP_MAP',
        targetId: id,
        details: {
          actorEmail,
          groupCN: existing.groupCN,
          before: {
            roleSlug: existing.role.slug,
            isActive: existing.isActive,
            description: existing.description,
          },
          after: {
            roleSlug: newRole.slug,
            isActive: m.isActive,
            description: m.description,
          },
        },
      },
    })
    return m
  })

  return NextResponse.json({ mapping: updated })
}

/**
 * DELETE — mapping sil. Mevcut UserRole.source='azure_ad' kayıtları
 * SİLİNMEZ; bir sonraki sync'te diff hesabıyla otomatik temizlenir
 * (mapping yoksa o grup eşleşmesi target'a girmez → toRemove'a düşer).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) return error
  const actorId = session.user.id
  const actorEmail = session.user.email

  const { id } = await params

  const existing = await prisma.ldapGroupRoleMap.findUnique({
    where: { id },
    include: { role: { select: { id: true, slug: true, name: true } } },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Mapping bulunamadı' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.ldapGroupRoleMap.delete({ where: { id } })
    await tx.permissionAuditLog.create({
      data: {
        action: 'LDAP_GROUP_MAP_DELETED',
        actorId,
        targetType: 'LDAP_GROUP_MAP',
        targetId: id,
        details: {
          actorEmail,
          groupCN: existing.groupCN,
          roleSlug: existing.role.slug,
          roleName: existing.role.name,
          isActive: existing.isActive,
          description: existing.description,
        },
      },
    })
  })

  return NextResponse.json({ success: true })
}
