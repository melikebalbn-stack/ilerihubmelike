import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

// PR-RECRUIT-RBAC: PublicJobApplication HR-only (recruitment.admin)

// GET - Başvuru detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    if (!session.user.permissions?.includes('recruitment.admin')) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const { id } = await params

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
    const { session, error } = await requireSession()
    if (error) return error

    if (!session.user.permissions?.includes('recruitment.admin')) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, notes } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

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

// DELETE - Başvuru sil (sadece admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    if (!session.user.permissions?.includes('recruitment.admin')) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const { id } = await params

    await prisma.publicJobApplication.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Basvuru silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
