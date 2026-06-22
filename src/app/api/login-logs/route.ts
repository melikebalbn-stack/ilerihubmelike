import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Login loglarını listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // PR-Y13: enum check yerine RBAC permission.
    // admin.audit.view → admin, bgys-sorumlusu, it-admin, super-admin
    if (!session.user.permissions?.includes('admin.audit.view')) {
      return NextResponse.json({ error: 'Bu sayfaya erişim yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const email = searchParams.get('email')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Filtre oluştur
    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (email) {
      where.email = { contains: email, mode: 'insensitive' }
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        ;(where.createdAt as Record<string, Date>).lte = endDate
      }
    }

    const total = await prisma.loginLog.count({ where })

    const logs = await prisma.loginLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    // İstatistikler
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const stats = await prisma.loginLog.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: today }
      },
      _count: true
    })

    const todaySuccess = stats.find(s => s.status === 'SUCCESS')?._count || 0
    const todayFailed = stats.find(s => s.status === 'FAILED')?._count || 0

    // Benzersiz kullanıcılar (bugün)
    const uniqueUsers = await prisma.loginLog.findMany({
      where: {
        createdAt: { gte: today },
        status: 'SUCCESS'
      },
      distinct: ['email'],
      select: { email: true }
    })

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        todaySuccess,
        todayFailed,
        todayUniqueUsers: uniqueUsers.length
      }
    })
  } catch (error) {
    console.error('Login logları yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
