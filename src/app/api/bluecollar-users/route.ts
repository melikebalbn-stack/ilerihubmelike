import { syncUserToAkademi } from '@/lib/akademi-sync'
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

    // Sıralama parametreleri
    const sortBy = searchParams.get('sortBy') || 'employeeId'
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
    const validSortFields = ['employeeId', 'name', 'department', 'jobTitle', 'duty', 'section', 'serviceRoute', 'serviceStop', 'lastLoginAt', 'isActive']
    const orderBy = validSortFields.includes(sortBy)
      ? { [sortBy]: sortOrder }
      : { employeeId: 'asc' as const }

    // Filtre parametreleri
    const filterDepartment = searchParams.get('department') || ''
    const filterServiceRoute = searchParams.get('serviceRoute') || ''
    const filterIsActive = searchParams.get('isActive') || ''

    const where: Record<string, unknown> = {
      employeeId: { not: null },
      ...(search && {
        OR: [
          { employeeId: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { department: { contains: search, mode: 'insensitive' as const } },
        ]
      }),
      ...(filterDepartment && { department: filterDepartment }),
      ...(filterServiceRoute && { serviceRoute: filterServiceRoute }),
      ...(filterIsActive && { isActive: filterIsActive === 'true' }),
    }

    // Filtre seçenekleri için distinct değerler
    const [users, total, distinctDepts, distinctRoutes] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          employeeId: true,
          // FIX #3: tcLastFour kaldırıldı - KVKK
          department: true,
          jobTitle: true,
          duty: true,
          section: true,
          serviceRoute: true,
          serviceStop: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.user.findMany({
        where: { employeeId: { not: null }, department: { not: null } },
        select: { department: true },
        distinct: ['department'],
        orderBy: { department: 'asc' },
      }),
      prisma.user.findMany({
        where: { employeeId: { not: null }, serviceRoute: { not: null } },
        select: { serviceRoute: true },
        distinct: ['serviceRoute'],
        orderBy: { serviceRoute: 'asc' },
      }),
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        departments: distinctDepts.map(d => d.department).filter(Boolean),
        serviceRoutes: distinctRoutes.map(r => r.serviceRoute).filter(Boolean),
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
    const { employeeId, tcLastFour, name, email, department, jobTitle, duty, section, serviceRoute, serviceStop } = body

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
        duty: duty || null,
        section: section || null,
        serviceRoute: serviceRoute || null,
        serviceStop: serviceStop || null,
        role: 'EMPLOYEE',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        employeeId: true,
        // FIX #3: tcLastFour kaldırıldı - KVKK
        department: true,
        jobTitle: true,
        duty: true,
        section: true,
        serviceRoute: true,
        serviceStop: true,
        isActive: true,
        createdAt: true,
      }
    })


    // Akademi'ye senkronize et (arka planda, hata ana islemi engellemez)
    syncUserToAkademi(user, "blue_collar").catch((err) =>
      console.error("Akademi sync hatasi:", err)
    )
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Mavi yaka kullanıcı oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
