import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api-response'

/**
 * GET: Tüm onay pozisyonlarını listele (kullanıcı bilgileriyle)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return apiUnauthorized()
    }

    const positions = await prisma.approvalPosition.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return apiSuccess(positions)
  } catch (error) {
    return apiError('Onay pozisyonları alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/approval-positions',
      error,
    })
  }
}

/**
 * PUT: Pozisyonlara kullanıcı ata (toplu güncelleme)
 * Body: [{ code: "FACTORY_MANAGER", userId: "clxyz..." | null }, ...]
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return apiUnauthorized()
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return apiError('Bu işlem için yetkiniz yok', 403)
    }

    const body = await request.json()

    if (!Array.isArray(body)) {
      return apiBadRequest('Geçersiz istek formatı')
    }

    const updates = await Promise.all(
      body.map((item: { code: string; userId: string | null; departments?: string[] }) => {
        const data: Record<string, unknown> = { userId: item.userId }
        if (item.departments !== undefined) {
          data.departments = item.departments
        }
        return prisma.approvalPosition.update({
          where: { code: item.code },
          data,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        })
      })
    )

    return apiSuccess(updates)
  } catch (error) {
    return apiError('Onay pozisyonları güncellenirken bir hata oluştu', 500, {
      endpoint: 'PUT /api/approval-positions',
      error,
    })
  }
}
