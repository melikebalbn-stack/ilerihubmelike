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
    const yakaRengi = searchParams.get('yakaRengi')
    const aktifParam = searchParams.get('aktif')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const aktif = aktifParam === 'false' ? false : true

    const where: any = { aktif }

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

    const [personnel, total] = await Promise.all([
      prisma.personnel.findMany({
        where,
        select: {
          id: true,
          sicilNo: true,
          sinif: true,
          cinsiyet: true,
          adSoyad: true,
          yakaRengi: true,
          direktEndirekt: true,
          asansorMekanik: true,
          iseGirisTarihi: true,
          gorev: true,
          bolumDetay: true,
          bolum: true,
          birimSorumlusu: true,
          bolumMuduru: true,
          masrafMerkezi: true,
          interKepMail: true,
          denemeDegerlendirme: true,
          altiAyDegerlendirme: true,
          telefon: true,
          kanGrubu: true,
          egitimYeri: true,
          egitimTipi: true,
          egitimAlani: true,
          mezuniyetYili: true,
          mykUstalikKalfalik: true,
          ilkYardimci: true,
          emekli: true,
          engelli: true,
          aktif: true,
          serviceRoute: true,
          serviceStop: true,
          azureAdEmail: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { adSoyad: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.personnel.count({ where }),
    ])

    return NextResponse.json({ personnel, total, page, limit })
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
