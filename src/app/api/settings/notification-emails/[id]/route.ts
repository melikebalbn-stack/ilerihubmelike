import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE - Bildirim e-postasını sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.calibrationNotificationEmail.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bildirim e-postası silinirken hata:', error)
    return NextResponse.json(
      { error: 'E-posta silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Bildirim e-postasını güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { email, name, isActive } = body

    const updated = await prisma.calibrationNotificationEmail.update({
      where: { id },
      data: { email, name, isActive },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Bildirim e-postası güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'E-posta güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
