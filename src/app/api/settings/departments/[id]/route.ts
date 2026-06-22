import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Tek bir departmanı getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const department = await prisma.calibrationDepartment.findUnique({
      where: { id },
    })

    if (!department) {
      return NextResponse.json({ error: 'Departman bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(department)
  } catch (error) {
    console.error('Departman alınırken hata:', error)
    return NextResponse.json({ error: 'Departman alınırken bir hata oluştu' }, { status: 500 })
  }
}

// PUT - Departmanı güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, code, isActive, sortOrder } = body

    const department = await prisma.calibrationDepartment.update({
      where: { id },
      data: {
        name,
        code: code || null,
        isActive,
        sortOrder,
      },
    })

    return NextResponse.json(department)
  } catch (error) {
    console.error('Departman güncellenirken hata:', error)
    return NextResponse.json({ error: 'Departman güncellenirken bir hata oluştu' }, { status: 500 })
  }
}

// DELETE - Departmanı sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.calibrationDepartment.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Departman silinirken hata:', error)
    return NextResponse.json({ error: 'Departman silinirken bir hata oluştu' }, { status: 500 })
  }
}
