import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Plan numarası oluştur
async function generatePlanNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PP-${year}-`

  const lastPlan = await prisma.projectPlan.findFirst({
    where: {
      planNumber: { startsWith: prefix }
    },
    orderBy: { planNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastPlan) {
    const lastNumber = parseInt(lastPlan.planNumber.split('-')[2])
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// GET - Proje planlarını listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const plans = await prisma.projectPlan.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Her plan için toplam değerleri hesapla
    const plansWithTotals = await Promise.all(
      plans.map(async (plan) => {
        const items = await prisma.projectPlanItem.findMany({
          where: { planId: plan.id }
        })

        const totalConsultant = items.reduce((sum, item) => sum + item.consultant, 0)
        const totalTarget = items.reduce((sum, item) => sum + item.target, 0)
        const totalActual = items.reduce((sum, item) => sum + item.actual, 0)

        return {
          ...plan,
          totalConsultant,
          totalTarget,
          totalActual
        }
      })
    )

    return NextResponse.json(plansWithTotals)
  } catch (error) {
    console.error('Proje planları yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni proje planı oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, label1, label2, label3, items = [] } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Plan başlığı zorunludur' },
        { status: 400 }
      )
    }

    const planNumber = await generatePlanNumber()

    const plan = await prisma.$transaction(async (tx) => {
      const newPlan = await tx.projectPlan.create({
        data: {
          planNumber,
          title,
          description,
          label1: label1 || 'Danışman',
          label2: label2 || 'Hedef',
          label3: label3 || 'Gerçekleşen',
          createdById: currentUser.id,
          status: 'ACTIVE'
        }
      })

      // Maddeleri ekle
      if (items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          await tx.projectPlanItem.create({
            data: {
              planId: newPlan.id,
              orderNo: i + 1,
              name: item.name,
              consultant: item.consultant || 0,
              target: item.target || 0,
              actual: item.actual || 0
            }
          })
        }
      }

      return newPlan
    })

    const planWithRelations = await prisma.projectPlan.findUnique({
      where: { id: plan.id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        items: {
          orderBy: { orderNo: 'asc' }
        }
      }
    })

    return NextResponse.json(planWithRelations, { status: 201 })
  } catch (error) {
    console.error('Proje planı oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
