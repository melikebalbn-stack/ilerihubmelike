import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece IT Manager veya Admin erişebilir
    if (session.user.role !== 'IT_MANAGER' && session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const period = parseInt(searchParams.get('period') || '30')

    if (!email) {
      return NextResponse.json({ error: 'Email gerekli' }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)

    // Bu kişiye atanan ticketları getir
    const tickets = await prisma.ticket.findMany({
      where: {
        assignedTo: email,
        createdAt: { gte: startDate },
        isActive: true,
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        respondedAt: true,
        resolvedAt: true,
        slaResponseBreached: true,
        slaResolutionBreached: true,
        satisfactionRating: true,
        category: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      email,
      period,
      tickets: tickets.map(t => ({
        ...t,
        categoryName: t.category?.name || 'Kategorisiz',
      })),
    })
  } catch (error) {
    console.error('Personel rapor hatasi:', error)
    return NextResponse.json({ error: 'Islem basarisiz' }, { status: 500 })
  }
}
