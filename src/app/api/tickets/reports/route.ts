import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isHelpdeskStaff } from '@/lib/helpdesk-auth'

// GET - IT Raporları (Sadece IT Manager erişebilir)
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-tickets: requireUser → user.role
    const { session, user, error } = await requireUser()
    if (error) return error

    // PR-Y9a: helpdesk-auth dual-check (permission önceliği + legacy fallback)
    if (!isHelpdeskStaff(user.role, user.department, session.user.permissions)) {
      return NextResponse.json({ error: 'Bu rapora erişim yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // Son 30 gün varsayılan
    const daysAgo = parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)

    // Tüm ticketlar (periyot içinde)
    const allTickets = await prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate },
        isActive: true,
      },
      select: {
        id: true,
        status: true,
        priority: true,
        ticketType: true,
        assignedTo: true,
        assignedToName: true,
        categoryId: true,
        category: { select: { name: true, color: true } },
        createdAt: true,
        respondedAt: true,
        resolvedAt: true,
        closedAt: true,
        slaResponseBreached: true,
        slaResolutionBreached: true,
        satisfactionRating: true,
      }
    })

    // Genel İstatistikler
    const totalTickets = allTickets.length
    const openTickets = allTickets.filter(t => ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'].includes(t.status)).length
    const resolvedTickets = allTickets.filter(t => t.status === 'RESOLVED').length
    const closedTickets = allTickets.filter(t => t.status === 'CLOSED').length
    const slaBreached = allTickets.filter(t => t.slaResponseBreached || t.slaResolutionBreached).length

    // Ortalama çözüm süresi (saat)
    const resolvedWithTime = allTickets.filter(t => t.resolvedAt && t.createdAt)
    const avgResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime()
          const resolved = new Date(t.resolvedAt!).getTime()
          return sum + (resolved - created)
        }, 0) / resolvedWithTime.length / (1000 * 60 * 60)
      : 0

    // Ortalama ilk yanıt süresi (saat)
    const respondedTickets = allTickets.filter(t => t.respondedAt && t.createdAt)
    const avgResponseTime = respondedTickets.length > 0
      ? respondedTickets.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime()
          const responded = new Date(t.respondedAt!).getTime()
          return sum + (responded - created)
        }, 0) / respondedTickets.length / (1000 * 60 * 60)
      : 0

    // Ortalama memnuniyet puanı
    const ratedTickets = allTickets.filter(t => t.satisfactionRating !== null)
    const avgSatisfaction = ratedTickets.length > 0
      ? ratedTickets.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) / ratedTickets.length
      : 0

    // Önceliğe göre dağılım
    const byPriority = {
      TICKET_CRITICAL: allTickets.filter(t => t.priority === 'TICKET_CRITICAL').length,
      TICKET_HIGH: allTickets.filter(t => t.priority === 'TICKET_HIGH').length,
      NORMAL: allTickets.filter(t => t.priority === 'NORMAL').length,
      TICKET_LOW: allTickets.filter(t => t.priority === 'TICKET_LOW').length,
    }

    // Tipe göre dağılım
    const byType = {
      INCIDENT: allTickets.filter(t => t.ticketType === 'INCIDENT').length,
      SERVICE_REQUEST: allTickets.filter(t => t.ticketType === 'SERVICE_REQUEST').length,
      PROBLEM: allTickets.filter(t => t.ticketType === 'PROBLEM').length,
      CHANGE_REQUEST: allTickets.filter(t => t.ticketType === 'CHANGE_REQUEST').length,
    }

    // Kategoriye göre dağılım
    const categoryMap = new Map<string, { name: string; color: string; count: number }>()
    allTickets.forEach(t => {
      if (t.category) {
        const key = t.categoryId || 'uncategorized'
        const existing = categoryMap.get(key)
        if (existing) {
          existing.count++
        } else {
          categoryMap.set(key, {
            name: t.category.name,
            color: t.category.color || '#6b7280',
            count: 1
          })
        }
      }
    })
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count)

    // Duruma göre dağılım
    const byStatus = {
      NEW: allTickets.filter(t => t.status === 'NEW').length,
      ASSIGNED: allTickets.filter(t => t.status === 'ASSIGNED').length,
      IN_PROGRESS: allTickets.filter(t => t.status === 'IN_PROGRESS').length,
      PENDING: allTickets.filter(t => t.status === 'PENDING').length,
      ON_HOLD: allTickets.filter(t => t.status === 'ON_HOLD').length,
      RESOLVED: allTickets.filter(t => t.status === 'RESOLVED').length,
      CLOSED: allTickets.filter(t => t.status === 'CLOSED').length,
      CANCELLED: allTickets.filter(t => t.status === 'CANCELLED').length,
    }

    // Bireysel Performans (Atanan kişiye göre)
    const assigneeMap = new Map<string, {
      email: string
      name: string
      totalAssigned: number
      resolved: number
      closed: number
      avgResponseTime: number // saat
      avgResolutionTime: number // saat
      slaBreached: number
      avgSatisfaction: number
    }>()

    allTickets.forEach(t => {
      if (t.assignedTo) {
        const key = t.assignedTo
        let assignee = assigneeMap.get(key)

        if (!assignee) {
          assignee = {
            email: t.assignedTo,
            name: t.assignedToName || t.assignedTo,
            totalAssigned: 0,
            resolved: 0,
            closed: 0,
            avgResponseTime: 0,
            avgResolutionTime: 0,
            slaBreached: 0,
            avgSatisfaction: 0,
          }
          assigneeMap.set(key, assignee)
        }

        assignee.totalAssigned++

        if (t.status === 'RESOLVED') assignee.resolved++
        if (t.status === 'CLOSED') assignee.closed++
        if (t.slaResponseBreached || t.slaResolutionBreached) assignee.slaBreached++
      }
    })

    // Ortalama süreleri hesapla
    for (const [email, assignee] of assigneeMap) {
      const assigneeTickets = allTickets.filter(t => t.assignedTo === email)

      // Yanıt süresi
      const responded = assigneeTickets.filter(t => t.respondedAt && t.createdAt)
      if (responded.length > 0) {
        assignee.avgResponseTime = responded.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime()
          const resp = new Date(t.respondedAt!).getTime()
          return sum + (resp - created)
        }, 0) / responded.length / (1000 * 60 * 60)
      }

      // Çözüm süresi
      const resolved = assigneeTickets.filter(t => t.resolvedAt && t.createdAt)
      if (resolved.length > 0) {
        assignee.avgResolutionTime = resolved.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime()
          const res = new Date(t.resolvedAt!).getTime()
          return sum + (res - created)
        }, 0) / resolved.length / (1000 * 60 * 60)
      }

      // Memnuniyet
      const rated = assigneeTickets.filter(t => t.satisfactionRating !== null)
      if (rated.length > 0) {
        assignee.avgSatisfaction = rated.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) / rated.length
      }
    }

    const individualPerformance = Array.from(assigneeMap.values())
      .sort((a, b) => b.totalAssigned - a.totalAssigned)

    // Günlük trend (son 7 gün)
    const dailyTrend: { date: string; created: number; resolved: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const created = allTickets.filter(t => {
        const createdDate = new Date(t.createdAt).toISOString().split('T')[0]
        return createdDate === dateStr
      }).length

      const resolved = allTickets.filter(t => {
        if (!t.resolvedAt) return false
        const resolvedDate = new Date(t.resolvedAt).toISOString().split('T')[0]
        return resolvedDate === dateStr
      }).length

      dailyTrend.push({ date: dateStr, created, resolved })
    }

    return NextResponse.json({
      period: daysAgo,
      summary: {
        totalTickets,
        openTickets,
        resolvedTickets,
        closedTickets,
        slaBreached,
        avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
        avgResponseTime: Math.round(avgResponseTime * 10) / 10,
        avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
        resolutionRate: totalTickets > 0 ? Math.round(((resolvedTickets + closedTickets) / totalTickets) * 100) : 0,
      },
      byPriority,
      byType,
      byStatus,
      byCategory,
      individualPerformance,
      dailyTrend,
    })
  } catch (error) {
    console.error('Rapor hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
