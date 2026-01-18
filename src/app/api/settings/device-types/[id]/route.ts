import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, code, isActive, sortOrder } = body

    const type = await prisma.calibrationDeviceType.update({
      where: { id },
      data: { name, code, isActive, sortOrder },
    })

    return NextResponse.json(type)
  } catch (error) {
    console.error('Cihaz tipi güncellenirken hata:', error)
    return NextResponse.json({ error: 'Cihaz tipi güncellenirken bir hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.calibrationDeviceType.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cihaz tipi silinirken hata:', error)
    return NextResponse.json({ error: 'Cihaz tipi silinirken bir hata oluştu' }, { status: 500 })
  }
}
