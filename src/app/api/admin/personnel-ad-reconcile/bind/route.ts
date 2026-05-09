import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/personnel-ad-reconcile/bind
 * Body: { userId: string, personnelId: string }
 *
 * User.personnelId = personnelId. User aktif olmalı, Personnel başka User'a
 * bağlı olmamalı (1:1 unique constraint zaten korur ama daha açıklayıcı 409 verir).
 *
 * Audit: PermissionAuditLog action=USER_PERSONNEL_LINKED.
 */
export async function POST(request: NextRequest) {
  const { session, user, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.users.manage')) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  let body: { userId?: unknown; personnelId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }
  const userId = typeof body.userId === 'string' ? body.userId : null
  const personnelId =
    typeof body.personnelId === 'string' ? body.personnelId : null
  if (!userId || !personnelId) {
    return NextResponse.json(
      { error: 'userId ve personnelId zorunlu' },
      { status: 400 }
    )
  }

  const [targetUser, personnel, existingBoundUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isActive: true, personnelId: true },
    }),
    prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { id: true, sicilNo: true, adSoyad: true, aktif: true },
    }),
    prisma.user.findFirst({
      where: { personnelId },
      select: { id: true, email: true },
    }),
  ])

  if (!targetUser) {
    return NextResponse.json({ error: 'User bulunamadı' }, { status: 404 })
  }
  if (!targetUser.isActive) {
    return NextResponse.json({ error: 'Pasif kullanıcı bağlanamaz' }, { status: 400 })
  }
  if (!personnel) {
    return NextResponse.json({ error: 'Personnel bulunamadı' }, { status: 404 })
  }
  if (existingBoundUser && existingBoundUser.id !== userId) {
    return NextResponse.json(
      {
        error: 'Bu Personnel zaten başka bir kullanıcıya bağlı',
        boundUserEmail: existingBoundUser.email,
      },
      { status: 409 }
    )
  }

  const previousPersonnelId = targetUser.personnelId

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { personnelId },
    })
    await tx.permissionAuditLog.create({
      data: {
        action: 'USER_PERSONNEL_LINKED',
        actorId: user.id,
        targetType: 'USER',
        targetId: userId,
        details: {
          actorEmail: user.email,
          targetUserEmail: targetUser.email,
          targetUserName: targetUser.name,
          personnelId: personnel.id,
          personnelSicilNo: personnel.sicilNo,
          personnelName: personnel.adSoyad,
          previousPersonnelId,
        },
      },
    })
  })

  return NextResponse.json({
    success: true,
    userId,
    personnelId,
    sicilNo: personnel.sicilNo,
    personnelName: personnel.adSoyad,
  })
}
