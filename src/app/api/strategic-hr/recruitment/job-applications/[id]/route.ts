import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, JobApplicationStatus } from '@/generated/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { updateApplicationStatus } from '@/lib/recruitment/stage-log'

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

    // Tek geçit: status değişimi helper'dan geçer (status + aşama logu aynı tx'te,
    // changedBy = İK kullanıcısı). status YOKSA yalnız diğer alanlar (notes) güncellenir
    // → log yazılmaz (davranış korunur). fromStatus == toStatus ise de log yazılmaz.
    const application = await prisma.$transaction(async (tx) => {
      if (status) {
        return updateApplicationStatus(tx, {
          applicationId: id,
          toStatus: status as JobApplicationStatus,
          changedBy: session.user.id,
          data: notes !== undefined ? { notes } : undefined,
        })
      }
      const updateData: Prisma.PublicJobApplicationUpdateInput = {}
      if (notes !== undefined) updateData.notes = notes
      return tx.publicJobApplication.update({ where: { id }, data: updateData })
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
