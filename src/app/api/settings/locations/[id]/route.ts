import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT - Lokasyon güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, code, isActive, sortOrder } = body

    const location = await prisma.calibrationLocation.update({
      where: { id },
      data: { name, code, isActive, sortOrder },
    })

    return NextResponse.json(location)
  } catch (error) {
    console.error('Lokasyon güncellenirken hata:', error)
    return NextResponse.json({ error: 'Lokasyon güncellenirken bir hata oluştu' }, { status: 500 })
  }
}

// DELETE - Lokasyon sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.calibrationLocation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lokasyon silinirken hata:', error)
    return NextResponse.json({ error: 'Lokasyon silinirken bir hata oluştu' }, { status: 500 })
  }
}
