import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Başvuru detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Yetki kontrolü
    const userRole = session.user.role || ''
    const userDepartment = session.user.department || ''
    const fullAccessRoles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'IT_MANAGER']
    const hrDepartments = ['insan varliklari', 'insan varlıkları', 'human resources', 'hr']
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept))
    const hasAccess = fullAccessRoles.includes(userRole) || isHrDepartment

    if (!hasAccess) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const application = await prisma.publicJobApplication.findUnique({
      where: { id }
    })

    if (!application) {
      return NextResponse.json({ error: 'Basvuru bulunamadi' }, { status: 404 })
    }

    return NextResponse.json(application)
  } catch (error) {
    console.error('Basvuru detayi alinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Başvuru durumu güncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Yetki kontrolü
    const userRole = session.user.role || ''
    const userDepartment = session.user.department || ''
    const fullAccessRoles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'IT_MANAGER']
    const hrDepartments = ['insan varliklari', 'insan varlıkları', 'human resources', 'hr']
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept))
    const hasAccess = fullAccessRoles.includes(userRole) || isHrDepartment

    if (!hasAccess) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const body = await request.json()
    const { status, notes } = body

    const updateData: any = {}

    if (status) {
      updateData.status = status
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    const application = await prisma.publicJobApplication.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(application)
  } catch (error) {
    console.error('Basvuru guncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Başvuru sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Yetki kontrolü - sadece admin silebilir
    const userRole = session.user.role || ''
    const fullAccessRoles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER']

    if (!fullAccessRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    await prisma.publicJobApplication.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Basvuru silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
