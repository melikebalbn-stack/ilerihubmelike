// TODO: Alanlar netlesince genisletilecek
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Tek stajyer detayi
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

    const intern = await prisma.intern.findUnique({
      where: { id },
    })

    if (!intern) {
      return NextResponse.json({ error: 'Stajyer bulunamadi' }, { status: 404 })
    }

    return NextResponse.json(intern)
  } catch (error) {
    console.error('Error fetching intern:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Stajyer guncelleme
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

    const intern = await prisma.intern.update({
      where: { id },
      data: {
        adSoyad: body.adSoyad,
        telefon: body.telefon || null,
        bolum: body.bolum,
        stajSorumlusu: body.stajSorumlusu || null,
        baslangicTarihi: body.baslangicTarihi ? new Date(body.baslangicTarihi) : null,
        bitisTarihi: body.bitisTarihi ? new Date(body.bitisTarihi) : null,
        okul: body.okul || null,
        aktif: body.aktif ?? true,
      },
    })

    return NextResponse.json(intern)
  } catch (error) {
    console.error('Error updating intern:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Stajyer silme (soft delete)
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

    await prisma.intern.update({
      where: { id },
      data: { aktif: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting intern:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
