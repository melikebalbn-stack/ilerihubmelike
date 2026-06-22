import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tek proje planı getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const plan = await prisma.projectPlan.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        items: {
          orderBy: { orderNo: 'asc' }
        }
      }
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Proje planı yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Proje planını güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existingPlan = await prisma.projectPlan.findUnique({
      where: { id }
    })

    if (!existingPlan) {
      return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, status, label1, label2, label3, items } = body

    const updatedPlan = await prisma.$transaction(async (tx) => {
      // Plan bilgilerini güncelle
      await tx.projectPlan.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(status && { status }),
          ...(label1 !== undefined && { label1 }),
          ...(label2 !== undefined && { label2 }),
          ...(label3 !== undefined && { label3 })
        }
      })

      // Eğer items gönderildiyse, tüm maddeleri güncelle
      if (items !== undefined) {
        // Önce mevcut maddeleri sil
        await tx.projectPlanItem.deleteMany({
          where: { planId: id }
        })

        // Yeni maddeleri ekle
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          await tx.projectPlanItem.create({
            data: {
              planId: id,
              orderNo: i + 1,
              name: item.name,
              consultant: item.consultant || 0,
              target: item.target || 0,
              actual: item.actual || 0
            }
          })
        }
      }

      return tx.projectPlan.findUnique({
        where: { id },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          items: {
            orderBy: { orderNo: 'asc' }
          }
        }
      })
    })

    return NextResponse.json(updatedPlan)
  } catch (error) {
    console.error('Proje planı güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Proje planını sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existingPlan = await prisma.projectPlan.findUnique({
      where: { id }
    })

    if (!existingPlan) {
      return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 })
    }

    await prisma.projectPlan.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Plan silindi' })
  } catch (error) {
    console.error('Proje planı silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
