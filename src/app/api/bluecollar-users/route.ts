import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Mavi yaka kullanıcıları listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece HR_MANAGER, ADMIN, SUPER_ADMIN erişebilir
    const userRole = session.user.role
    if (!['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where = {
      employeeId: { not: null },
      ...(search && {
        OR: [
          { employeeId: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { department: { contains: search, mode: 'insensitive' as const } },
        ]
      })
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          employeeId: true,
          tcLastFour: true,
          department: true,
          jobTitle: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { employeeId: 'asc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Mavi yaka kullanıcıları yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni mavi yaka kullanıcı ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece HR_MANAGER, ADMIN, SUPER_ADMIN erişebilir
    const userRole = session.user.role
    if (!['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    const body = await request.json()
    const { employeeId, tcLastFour, name, email, department, jobTitle } = body

    // Doğrulama
    if (!employeeId || !tcLastFour || !name) {
      return NextResponse.json(
        { error: 'Sicil numarası, TC son 4 hane ve ad soyad zorunludur' },
        { status: 400 }
      )
    }

    // TC son 4 hane doğrulama
    if (!/^\d{4}$/.test(tcLastFour)) {
      return NextResponse.json(
        { error: 'TC son 4 hane 4 rakamdan oluşmalıdır' },
        { status: 400 }
      )
    }

    // Sicil numarası benzersiz mi kontrol et
    const existingByEmployeeId = await prisma.user.findUnique({
      where: { employeeId }
    })

    if (existingByEmployeeId) {
      return NextResponse.json(
        { error: 'Bu sicil numarası zaten kayıtlı' },
        { status: 400 }
      )
    }

    // Email oluştur (verilmediyse)
    const userEmail = email || `${employeeId}@bluecollar.ilerigroup.com`

    // Email benzersiz mi kontrol et
    const existingByEmail = await prisma.user.findUnique({
      where: { email: userEmail }
    })

    if (existingByEmail) {
      return NextResponse.json(
        { error: 'Bu email adresi zaten kayıtlı' },
        { status: 400 }
      )
    }

    // Kullanıcı oluştur
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        employeeId,
        tcLastFour,
        name,
        department,
        jobTitle,
        role: 'EMPLOYEE',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        employeeId: true,
        tcLastFour: true,
        department: true,
        jobTitle: true,
        isActive: true,
        createdAt: true,
      }
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Mavi yaka kullanıcı oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
