import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

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
    // PR-Y2.5-personnel: requireUser — accessLog yazımı + admin role
    const { user, error } = await requireUser()
    if (error) return error

    if (!VIEW_ROLES.includes(user.role)) {
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
        accessedBy: user.id,
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
        ibanNo: sensitive.ibanNo,
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
      ibanNo: maskValue(sensitive.ibanNo),
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
    // PR-Y2.5-personnel: requireUser — updatedBy yazımı + admin role
    const { user, error } = await requireUser()
    if (error) return error

    if (!UPDATE_ROLES.includes(user.role)) {
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

    body.updatedBy = user.id

    const updatedSensitive = await prisma.personnelSensitive.upsert({
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
        accessedBy: user.id,
        accessType: 'UPDATE_SENSITIVE',
        ipAddress,
      },
    })

    return NextResponse.json(updatedSensitive)
  } catch (error) {
    console.error('Hassas veri güncellenirken hata:', error)
    return NextResponse.json({ error: 'Hassas veri güncellenirken bir hata oluştu' }, { status: 500 })
  }
}
