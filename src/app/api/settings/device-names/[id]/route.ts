import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Tek bir cihaz adını getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deviceName = await prisma.calibrationDeviceName.findUnique({
      where: { id },
    })

    if (!deviceName) {
      return NextResponse.json({ error: 'Cihaz adı bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(deviceName)
  } catch (error) {
    console.error('Cihaz adı alınırken hata:', error)
    return NextResponse.json({ error: 'Cihaz adı alınırken bir hata oluştu' }, { status: 500 })
  }
}

// PUT - Cihaz adını güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, code, isActive, sortOrder } = body

    const deviceName = await prisma.calibrationDeviceName.update({
      where: { id },
      data: {
        name,
        code: code || null,
        isActive,
        sortOrder,
      },
    })

    return NextResponse.json(deviceName)
  } catch (error) {
    console.error('Cihaz adı güncellenirken hata:', error)
    return NextResponse.json({ error: 'Cihaz adı güncellenirken bir hata oluştu' }, { status: 500 })
  }
}

// DELETE - Cihaz adını sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.calibrationDeviceName.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cihaz adı silinirken hata:', error)
    return NextResponse.json({ error: 'Cihaz adı silinirken bir hata oluştu' }, { status: 500 })
  }
}
