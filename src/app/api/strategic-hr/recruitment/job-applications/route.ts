import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

// GET - Tüm iş başvurularını listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department session'dan)
    const { session, error } = await requireSession()
    if (error) return error

    // Yetki kontrolü - sadece IK ve admin görebilir
    const userRole = session.user.role || ''
    const userDepartment = session.user.department || ''
    const fullAccessRoles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'IT_MANAGER']
    const hrDepartments = ['insan varliklari', 'insan varlıkları', 'human resources', 'hr']
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept))
    const hasAccess = fullAccessRoles.includes(userRole) || isHrDepartment

    if (!hasAccess) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Filtreleme
    const where: any = {}

    if (status && status !== 'all') {
      where.status = status
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobilePhone: { contains: search, mode: 'insensitive' } },
        { applicationNumber: { contains: search, mode: 'insensitive' } },
        { requestedPosition: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Başvuruları getir
    const [applications, total] = await Promise.all([
      prisma.publicJobApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          applicationNumber: true,
          fullName: true,
          email: true,
          mobilePhone: true,
          birthDate: true,
          gender: true,
          requestedPosition: true,
          expectedSalary: true,
          availableStartDate: true,
          educationLevel: true,
          referralSource: true,
          photoUrl: true,
          status: true,
          notes: true,
          digitalSignature: true,
          signatureDate: true,
          createdAt: true,
        }
      }),
      prisma.publicJobApplication.count({ where })
    ])

    return NextResponse.json({
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Is basvurulari listelenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
