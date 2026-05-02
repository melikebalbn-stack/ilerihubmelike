import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  if (!dept) return false
  const d = dept.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

function hasPersonnelAccess(role: string, department?: string | null): boolean {
  return ALLOWED_ROLES.includes(role) || isHRDepartment(department)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const bolum = searchParams.get('bolum')
    const yakaRengi = searchParams.get('yakaRengi') || searchParams.get('yaka')
    const durumParam = searchParams.get('durum')
    const aktifParam = searchParams.get('aktif')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const sortBy = searchParams.get('sortBy') || 'adSoyad'
    const sortDir = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'

    // Durum filtresi
    const where: any = {}
    if (durumParam === 'PASIF') {
      where.aktif = false
    } else if (durumParam === 'TUMU') {
      // tümü - aktif filtresi yok
    } else if (aktifParam === 'false') {
      where.aktif = false
    } else {
      where.aktif = true
    }

    if (bolum) {
      where.bolum = bolum
    }

    if (yakaRengi) {
      where.yakaRengi = yakaRengi
    }

    if (search) {
      where.OR = [
        { adSoyad: { contains: search, mode: 'insensitive' } },
        { sicilNo: { contains: search, mode: 'insensitive' } },
        { gorev: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Sıralama
    const orderBy: any = {}
    orderBy[sortBy] = sortDir

    const [personnel, total] = await Promise.all([
      prisma.personnel.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.personnel.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      personnel,
      total,
      page,
      limit,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('Personel listesi alınırken hata:', error)
    return NextResponse.json({ error: 'Personel listesi alınırken bir hata oluştu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any).role
    const userDept = (session.user as any).department
    if (!hasPersonnelAccess(userRole, userDept)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const body = await request.json()
    const { sensitive, ...personnelData } = body

    // Parse date fields
    if (personnelData.iseGirisTarihi) {
      personnelData.iseGirisTarihi = new Date(personnelData.iseGirisTarihi)
    }
    if (personnelData.denemeDegerlendirme) {
      personnelData.denemeDegerlendirme = new Date(personnelData.denemeDegerlendirme)
    }
    if (personnelData.altiAyDegerlendirme) {
      personnelData.altiAyDegerlendirme = new Date(personnelData.altiAyDegerlendirme)
    }
    if (personnelData.ilkYardimciBelgesi) {
      personnelData.ilkYardimciBelgesi = new Date(personnelData.ilkYardimciBelgesi)
    }
    if (personnelData.kalfalikBelgesi) {
      personnelData.kalfalikBelgesi = new Date(personnelData.kalfalikBelgesi)
    }
    if (personnelData.ustalikBelgesi) {
      personnelData.ustalikBelgesi = new Date(personnelData.ustalikBelgesi)
    }
    if (personnelData.yanginSertifikasi) {
      personnelData.yanginSertifikasi = new Date(personnelData.yanginSertifikasi)
    }
    if (personnelData.mykBelgesiTarihi) {
      personnelData.mykBelgesiTarihi = new Date(personnelData.mykBelgesiTarihi)
    }

    // Parse int fields
    if (personnelData.mezuniyetYili) {
      personnelData.mezuniyetYili = parseInt(personnelData.mezuniyetYili) || null
    }

    // Boş stringleri temizle (Prisma enum hataları için)
    for (const key of Object.keys(personnelData)) {
      if (personnelData[key] === '') personnelData[key] = null
    }

    personnelData.createdBy = session.user.id

    const personnel = await prisma.personnel.create({
      data: personnelData,
    })

    // Create sensitive record if provided
    if (sensitive && Object.keys(sensitive).length > 0) {
      if (sensitive.dogumTarihi) {
        sensitive.dogumTarihi = new Date(sensitive.dogumTarihi)
      }

      await prisma.personnelSensitive.create({
        data: {
          personnelId: personnel.id,
          updatedBy: session.user.id,
          ...sensitive,
        },
      })

      // Log sensitive data write
      await prisma.personnelAccessLog.create({
        data: {
          personnelId: personnel.id,
          accessedBy: session.user.id,
          accessType: 'CREATE_SENSITIVE',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        },
      })
    }

    return NextResponse.json(personnel, { status: 201 })
  } catch (error: any) {
    console.error('Personel oluşturulurken hata:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Bu sicil numarası zaten kayıtlı' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Personel oluşturulurken bir hata oluştu' }, { status: 500 })
  }
}
