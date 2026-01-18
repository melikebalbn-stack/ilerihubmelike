import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE - Bildirim kuralını sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.calibrationNotificationRule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bildirim kuralı silinirken hata:', error)
    return NextResponse.json(
      { error: 'Kural silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Bildirim kuralını güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { repeatWeekly, isActive } = body

    const updated = await prisma.calibrationNotificationRule.update({
      where: { id },
      data: { repeatWeekly, isActive },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Bildirim kuralı güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Kural güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
