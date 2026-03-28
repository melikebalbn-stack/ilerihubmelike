import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const VIEW_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
const UPDATE_ROLES = ['ADMIN', 'SUPER_ADMIN']

function maskValue(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.length <= 6) return '***'
  return value.substring(0, 3) + '****' + value.substring(value.length - 3)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any).role
    if (!VIEW_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const unmask = searchParams.get('unmask') === 'true'

    const sensitive = await prisma.personnelSensitive.findUnique({
      where: { personnelId: id },
    })

    if (!sensitive) {
      return NextResponse.json({ error: 'Hassas veri bulunamadı' }, { status: 404 })
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null

    // Log access
    await prisma.personnelAccessLog.create({
      data: {
        personnelId: id,
        accessedBy: session.user.id,
        accessType: unmask ? 'UNMASK_SENSITIVE' : 'VIEW_SENSITIVE',
        ipAddress,
      },
    })

    if (unmask) {
      return NextResponse.json({
        id: sensitive.id,
        personnelId: sensitive.personnelId,
        tcKimlikNo: sensitive.tcKimlikNo,
        sgkNo: sensitive.sgkNo,
        dogumTarihi: sensitive.dogumTarihi,
        bankaSube: sensitive.bankaSube,
        bankaHesapNo: sensitive.bankaHesapNo,
        updatedAt: sensitive.updatedAt,
        updatedBy: sensitive.updatedBy,
      })
    }

    // Masked response
    return NextResponse.json({
      id: sensitive.id,
      personnelId: sensitive.personnelId,
      tcKimlikNo: maskValue(sensitive.tcKimlikNo),
      sgkNo: maskValue(sensitive.sgkNo),
      dogumTarihi: sensitive.dogumTarihi,
      bankaSube: sensitive.bankaSube,
      bankaHesapNo: maskValue(sensitive.bankaHesapNo),
      updatedAt: sensitive.updatedAt,
      updatedBy: sensitive.updatedBy,
    })
  } catch (error) {
    console.error('Hassas veri alınırken hata:', error)
    return NextResponse.json({ error: 'Hassas veri alınırken bir hata oluştu' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any).role
    if (!UPDATE_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    // Verify personnel exists
    const personnel = await prisma.personnel.findUnique({ where: { id } })
    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    const body = await request.json()

    // Parse date fields
    if (body.dogumTarihi) {
      body.dogumTarihi = new Date(body.dogumTarihi)
    }

    // Remove fields that should not be updated
    delete body.id
    delete body.personnelId
    delete body.createdAt
    delete body.updatedAt

    body.updatedBy = session.user.id

    const sensitive = await prisma.personnelSensitive.upsert({
      where: { personnelId: id },
      update: body,
      create: {
        personnelId: id,
        ...body,
      },
    })

    // Log update
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    await prisma.personnelAccessLog.create({
      data: {
        personnelId: id,
        accessedBy: session.user.id,
        accessType: 'UPDATE_SENSITIVE',
        ipAddress,
      },
    })

    return NextResponse.json(sensitive)
  } catch (error) {
    console.error('Hassas veri güncellenirken hata:', error)
    return NextResponse.json({ error: 'Hassas veri güncellenirken bir hata oluştu' }, { status: 500 })
  }
}
