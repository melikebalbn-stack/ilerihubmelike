import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/roles/[id]
 * Tek rol detayı: meta + modül-bazlı izin özet (granted/total) + atanmış kullanıcı listesi.
 * SUPER_ADMIN-only.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireUser()
  if (error) return error
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Rol detayı için SUPER_ADMIN yetkisi gerekli' },
      { status: 403 }
    )
  }

  const { id } = await params

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: {
          permission: {
            select: { id: true, key: true, module: true, description: true },
          },
        },
      },
      userRoles: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true,
              department: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      },
    },
  })

  if (!role) {
    return NextResponse.json({ error: 'Rol bulunamadı' }, { status: 404 })
  }

  const allPermissions = await prisma.permission.findMany({
    select: { module: true },
  })
  const totalsByModule = allPermissions.reduce<Record<string, number>>((acc, p) => {
    acc[p.module] = (acc[p.module] ?? 0) + 1
    return acc
  }, {})

  const grantedByModule = role.rolePermissions.reduce<Record<string, number>>((acc, rp) => {
    const m = rp.permission.module
    acc[m] = (acc[m] ?? 0) + 1
    return acc
  }, {})

  const moduleStats = Object.keys(totalsByModule)
    .map((module) => ({
      module,
      granted: grantedByModule[module] ?? 0,
      total: totalsByModule[module],
    }))
    .filter((s) => s.granted > 0)
    .sort((a, b) => b.granted - a.granted)

  return NextResponse.json({
    role: {
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isProtected: role.isProtected,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role.userRoles.length,
      permissionCount: role.rolePermissions.length,
      moduleStats,
      users: role.userRoles.map((ur) => ({
        id: ur.user.id,
        name: ur.user.name,
        email: ur.user.email,
        jobTitle: ur.user.jobTitle,
        department: ur.user.department,
        assignedAt: ur.assignedAt,
        source: ur.source,
      })),
    },
  })
}

/**
 * PATCH /api/roles/[id]
 * Meta düzenleme: ad, açıklama. slug ve isSystem KORUNUR.
 * SUPER_ADMIN-only. PermissionAuditLog'a ROLE_UPDATED kaydı düşer.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireUser()
  if (error) return error
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Rol düzenleme için SUPER_ADMIN yetkisi gerekli' },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    description?: string | null
  }

  const existing = await prisma.role.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Rol bulunamadı' }, { status: 404 })
  }

  const data: { name?: string; description?: string | null } = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Rol adı en az 2 karakter olmalı' },
        { status: 400 }
      )
    }
    if (body.name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Rol adı 100 karakteri aşamaz' },
        { status: 400 }
      )
    }
    const trimmed = body.name.trim()
    if (trimmed !== existing.name) {
      const duplicate = await prisma.role.findFirst({
        where: { name: trimmed, NOT: { id } },
        select: { id: true },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: `'${trimmed}' adında başka bir rol mevcut` },
          { status: 409 }
        )
      }
      data.name = trimmed
    }
  }

  if (body.description !== undefined) {
    if (body.description === null || body.description === '') {
      data.description = null
    } else if (typeof body.description === 'string') {
      if (body.description.length > 500) {
        return NextResponse.json(
          { error: 'Açıklama 500 karakteri aşamaz' },
          { status: 400 }
        )
      }
      data.description = body.description.trim() || null
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({
      role: existing,
      message: 'Değişiklik yok',
    })
  }

  const updated = await prisma.role.update({
    where: { id },
    data,
  })

  await prisma.permissionAuditLog.create({
    data: {
      action: 'ROLE_UPDATED',
      actorId: user.id,
      targetType: 'ROLE',
      targetId: id,
      details: {
        actorEmail: user.email,
        before: { name: existing.name, description: existing.description },
        after: { name: updated.name, description: updated.description },
      },
    },
  }).catch((err) => {
    console.error('[role PATCH] audit log fail:', err)
  })

  return NextResponse.json({
    role: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      isSystem: updated.isSystem,
      isProtected: updated.isProtected,
      updatedAt: updated.updatedAt,
    },
  })
}
