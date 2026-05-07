import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api-response'
import { requireUser } from '@/lib/auth/require-user'

/**
 * GET: Yetkili kullanıcıları listele veya mevcut kullanıcının yetkisini kontrol et
 * ?check=me → { authorized: boolean } (sidebar için hafif kontrol)
 * Normal → yetkili kullanıcı listesi
 */
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-overtime: requireUser — role + id check
    const { user, error } = await requireUser()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const check = searchParams.get('check')

    // Sidebar hafif kontrol modu
    if (check === 'me') {
      // Admin her zaman yetkili
      if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        return apiSuccess({ authorized: true })
      }

      const authorized = await prisma.overtimeAuthorizedUser.findUnique({
        where: { userId: user.id },
      })

      return apiSuccess({ authorized: !!authorized })
    }

    // Admin kontrolü (liste görüntüleme)
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return apiError('Bu işlem için yetkiniz yok', 403)
    }

    const authorizedUsers = await prisma.overtimeAuthorizedUser.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return apiSuccess(authorizedUsers)
  } catch (error) {
    return apiError('Yetkili kullanıcılar alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/overtime/authorized-users',
      error,
    })
  }
}

/**
 * POST: Yetkili kullanıcı ekle (sadece SUPER_ADMIN/ADMIN)
 * Body: { userId }
 */
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-overtime: requireUser — admin role check
    const { user, error } = await requireUser()
    if (error) return error
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return apiError('Bu işlem için yetkiniz yok', 403)
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return apiBadRequest('userId zorunludur')
    }

    // Kullanıcı var mı kontrol et
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    })

    if (!targetUser) {
      return apiBadRequest('Kullanıcı bulunamadı')
    }

    // Zaten yetkili mi kontrol et
    const existing = await prisma.overtimeAuthorizedUser.findUnique({
      where: { userId },
    })

    if (existing) {
      return apiBadRequest('Bu kullanıcı zaten yetkili')
    }

    const authorized = await prisma.overtimeAuthorizedUser.create({
      data: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            jobTitle: true,
          },
        },
      },
    })

    return apiSuccess(authorized, 201)
  } catch (error) {
    return apiError('Yetkili kullanıcı eklenirken bir hata oluştu', 500, {
      endpoint: 'POST /api/overtime/authorized-users',
      error,
    })
  }
}

/**
 * DELETE: Yetkili kullanıcıyı kaldır (sadece SUPER_ADMIN/ADMIN)
 * Body: { userId }
 */
export async function DELETE(request: NextRequest) {
  try {
    // PR-Y2.5-overtime: requireUser — admin role check
    const { user, error } = await requireUser()
    if (error) return error
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return apiError('Bu işlem için yetkiniz yok', 403)
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return apiBadRequest('userId zorunludur')
    }

    const existing = await prisma.overtimeAuthorizedUser.findUnique({
      where: { userId },
    })

    if (!existing) {
      return apiBadRequest('Bu kullanıcı zaten yetkili değil')
    }

    await prisma.overtimeAuthorizedUser.delete({
      where: { userId },
    })

    return apiSuccess({ message: 'Yetki kaldırıldı' })
  } catch (error) {
    return apiError('Yetki kaldırılırken bir hata oluştu', 500, {
      endpoint: 'DELETE /api/overtime/authorized-users',
      error,
    })
  }
}
