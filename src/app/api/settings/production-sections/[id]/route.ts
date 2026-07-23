import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT - Üretim bölümü güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, code, departmentId, isActive, sortOrder } = body

    const section = await prisma.calibrationProductionSection.update({
      where: { id },
      data: { name, code, departmentId: departmentId || null, isActive, sortOrder },
      include: { department: { select: { id: true, name: true } } },
    })

    return NextResponse.json(section)
  } catch (error) {
    console.error('Üretim bölümü güncellenirken hata:', error)
    return NextResponse.json({ error: 'Üretim bölümü güncellenirken bir hata oluştu' }, { status: 500 })
  }
}

// DELETE - Üretim bölümü sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.calibrationProductionSection.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Üretim bölümü silinirken hata:', error)
    return NextResponse.json({ error: 'Üretim bölümü silinirken bir hata oluştu' }, { status: 500 })
  }
}
