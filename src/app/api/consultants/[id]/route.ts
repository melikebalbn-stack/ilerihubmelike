// TODO: Alanlar netlesince genisletilecek
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Tek danisman detayi
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const consultant = await prisma.consultant.findUnique({
      where: { id },
    })

    if (!consultant) {
      return NextResponse.json({ error: 'Danisman bulunamadi' }, { status: 404 })
    }

    return NextResponse.json(consultant)
  } catch (error) {
    console.error('Error fetching consultant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Danisman guncelleme
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Yetkisiz islem' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const consultant = await prisma.consultant.update({
      where: { id },
      data: {
        adSoyad: body.adSoyad,
        telefon: body.telefon || null,
        email: body.email || null,
        bolum: body.bolum || null,
        uzmanlikAlani: body.uzmanlikAlani || null,
        sozlesmeBaslangic: body.sozlesmeBaslangic ? new Date(body.sozlesmeBaslangic) : null,
        sozlesmeBitis: body.sozlesmeBitis ? new Date(body.sozlesmeBitis) : null,
        aktif: body.aktif ?? true,
      },
    })

    return NextResponse.json(consultant)
  } catch (error) {
    console.error('Error updating consultant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Danisman silme (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Yetkisiz islem' }, { status: 403 })
    }

    const { id } = await params

    await prisma.consultant.update({
      where: { id },
      data: { aktif: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting consultant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
