import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isHelpdeskStaff } from '@/lib/helpdesk-auth'

// GET - Ticket istatistikleri
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-tickets: requireUser + session (ou LDAP-only)
    const { session, user, error } = await requireUser()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('viewMode') || 'all'
    const userEmail = user.email
    const userOu = (session.user.ou || '').toLowerCase()
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

    // PR-Y9a: helpdesk-auth helper (dual-check tampon).
    // userOu (LDAP-only) + user.department birlikte değerlendirilir; helper
    // bunlardan birini "kalite/sistem/bilgi teknoloji" pattern ile match eder.
    const isITStaff =
      isHelpdeskStaff(user.role, user.department, session.user.permissions) ||
      isHelpdeskStaff(user.role, userOu, session.user.permissions)

    // Temel filtre
    const baseWhere: Record<string, unknown> = { isActive: true }

    if (viewMode === 'my') {
      baseWhere.requesterEmail = userEmail
    } else if (viewMode === 'assigned') {
      baseWhere.assignedTo = userEmail
    }

    // İstatistikleri paralel olarak çek
    const [
      totalOpen,
      totalNew,
      totalAssigned,
      totalInProgress,
      totalPending,
      totalResolved,
      totalClosed,
      myTickets,
      assignedToMe,
      slaBreached,
      byPriority,
      byCategory,
      recentTickets,
    ] = await Promise.all([
      // Açık ticket sayısı
      prisma.ticket.count({
        where: {
          ...baseWhere,
          status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'] }
        }
      }),
      // Yeni ticket sayısı
      prisma.ticket.count({
        where: { ...baseWhere, status: 'NEW' }
      }),
      // Atanmış ticket sayısı
      prisma.ticket.count({
        where: { ...baseWhere, status: 'ASSIGNED' }
      }),
      // İşlemde ticket sayısı
      prisma.ticket.count({
        where: { ...baseWhere, status: 'IN_PROGRESS' }
      }),
      // Beklemede ticket sayısı
      prisma.ticket.count({
        where: { ...baseWhere, status: 'PENDING' }
      }),
      // Çözüldü ticket sayısı
      prisma.ticket.count({
        where: { ...baseWhere, status: 'RESOLVED' }
      }),
      // Kapatıldı ticket sayısı (bu ay)
      prisma.ticket.count({
        where: {
          ...baseWhere,
          status: 'CLOSED',
          closedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      // Benim ticket'larım
      prisma.ticket.count({
        where: {
          isActive: true,
          requesterEmail: userEmail,
          status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'] }
        }
      }),
      // Bana atanan ticket'lar
      prisma.ticket.count({
        where: {
          isActive: true,
          assignedTo: userEmail,
          status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'] }
        }
      }),
      // SLA ihlali
      prisma.ticket.count({
        where: {
          isActive: true,
          OR: [
            { slaResponseBreached: true },
            { slaResolutionBreached: true }
          ],
          status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'] }
        }
      }),
      // Önceliğe göre dağılım
      prisma.ticket.groupBy({
        by: ['priority'],
        where: {
          isActive: true,
          status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'] }
        },
        _count: true,
      }),
      // Kategoriye göre dağılım
      prisma.ticket.groupBy({
        by: ['categoryId'],
        where: {
          isActive: true,
          status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'] }
        },
        _count: true,
      }),
      // Son ticket'lar - IT ekibi tümünü, normal kullanıcılar sadece kendi taleplerini görür
      prisma.ticket.findMany({
        where: isITStaff
          ? { isActive: true }
          : { isActive: true, requesterEmail: userEmail },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          requesterName: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    // Kategorileri çek (grup sonuçları için)
    const categories = await prisma.ticketCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true }
    })

    const categoryMap = new Map(categories.map(c => [c.id, c]))

    return NextResponse.json({
      summary: {
        totalOpen,
        totalNew,
        totalAssigned,
        totalInProgress,
        totalPending,
        totalResolved,
        totalClosedThisMonth: totalClosed,
        myOpenTickets: myTickets,
        assignedToMe,
        slaBreached,
      },
      byPriority: byPriority.map(p => ({
        priority: p.priority,
        count: p._count,
      })),
      byCategory: byCategory.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.categoryId ? categoryMap.get(c.categoryId)?.name : 'Kategorisiz',
        categoryColor: c.categoryId ? categoryMap.get(c.categoryId)?.color : null,
        count: c._count,
      })),
      recentTickets,
    })
  } catch (error) {
    console.error('İstatistik hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
