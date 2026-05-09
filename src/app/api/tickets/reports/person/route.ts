import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isHelpdeskStaff } from '@/lib/helpdesk-auth'

export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-tickets: requireUser → user.role
    const { session, user, error } = await requireUser()
    if (error) return error

    // PR-Y9a: helpdesk-auth dual-check (permission önceliği + legacy fallback)
    if (!isHelpdeskStaff(user.role, user.department, session.user.permissions)) {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    // PR-Y2.5-tickets: query email lowercase normalize (DB casing invariant)
    const email = searchParams.get('email')?.toLowerCase()
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
