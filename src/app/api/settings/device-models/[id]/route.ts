import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, manufacturer, code, isActive, sortOrder } = body

    const model = await prisma.calibrationDeviceModel.update({
      where: { id },
      data: { name, manufacturer, code, isActive, sortOrder },
    })

    return NextResponse.json(model)
  } catch (error) {
    console.error('Cihaz modeli güncellenirken hata:', error)
    return NextResponse.json({ error: 'Cihaz modeli güncellenirken bir hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.calibrationDeviceModel.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cihaz modeli silinirken hata:', error)
    return NextResponse.json({ error: 'Cihaz modeli silinirken bir hata oluştu' }, { status: 500 })
  }
}
