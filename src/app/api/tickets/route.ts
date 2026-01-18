import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// IT Ekibi kontrolü
function isITStaff(role: string, department: string | null): boolean {
  const itRoles = ['IT_MANAGER', 'ADMIN', 'SUPER_ADMIN']
  if (itRoles.includes(role)) return true

  if (department) {
    const dept = department.toLowerCase()
    if (dept.includes('sistem') || dept.includes('bilgi teknoloji') || dept.includes('information')) {
      return true
    }
  }
  return false
}

// Ticket numarası oluştur
async function generateTicketNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TKT-${year}-`

  const lastTicket = await prisma.ticket.findFirst({
    where: {
      ticketNumber: { startsWith: prefix }
    },
    orderBy: { ticketNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastTicket) {
    const lastNumber = parseInt(lastTicket.ticketNumber.split('-').pop() || '0')
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// SLA hesapla
function calculateSLA(priority: string, createdAt: Date) {
  // Varsayılan SLA süreleri (dakika)
  const slaTimes: Record<string, { response: number; resolution: number }> = {
    TICKET_CRITICAL: { response: 15, resolution: 120 },
    TICKET_HIGH: { response: 60, resolution: 480 },
    NORMAL: { response: 240, resolution: 1440 },
    TICKET_LOW: { response: 480, resolution: 2880 },
  }

  const sla = slaTimes[priority] || slaTimes.NORMAL

  return {
    slaResponseDue: new Date(createdAt.getTime() + sla.response * 60 * 1000),
    slaResolutionDue: new Date(createdAt.getTime() + sla.resolution * 60 * 1000),
  }
}

// GET - Ticket listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('viewMode') || 'all'
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')

    const userEmail = session.user.email
    const userRole = session.user.role
    const userDept = session.user.department || null
    const userIsITStaff = isITStaff(userRole, userDept)

    // Filtreler
    const where: Record<string, unknown> = {
      isActive: true,
    }

    // Görünüm moduna göre filtrele
    if (viewMode === 'my') {
      // Benim açtığım ticket'lar
      where.requesterEmail = userEmail
    } else if (viewMode === 'assigned') {
      // Bana atanan ticket'lar (sadece IT ekibi)
      if (!userIsITStaff) {
        where.requesterEmail = userEmail // IT değilse kendi ticket'larını görsün
      } else {
        where.assignedTo = userEmail
      }
    } else if (viewMode === 'all') {
      // Tüm ticket'lar (sadece IT ekibi)
      if (!userIsITStaff) {
        where.requesterEmail = userEmail // IT değilse kendi ticket'larını görsün
      }
      // IT ekibi için filtre yok - hepsini görür
    } else if (viewMode === 'open') {
      // Açık ticket'lar
      where.status = { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'] }
      // Normal kullanıcılar sadece kendi açık ticket'larını görsün
      if (!userIsITStaff) {
        where.requesterEmail = userEmail
      }
    }

    // Durum filtresi
    if (status) {
      where.status = status
    }

    // Öncelik filtresi
    if (priority) {
      where.priority = priority
    }

    // Kategori filtresi
    if (categoryId) {
      where.categoryId = categoryId
    }

    // Arama
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { requesterName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true }
        },
        assignedTeam: {
          select: { id: true, name: true }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error('Ticket listesi hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// POST - Yeni ticket oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      subject,
      description,
      ticketType = 'INCIDENT',
      categoryId,
      priority = 'NORMAL',
      impact = 'INDIVIDUAL',
      urgency = 'MEDIUM',
      location,
      assetInfo,
      attachments,
    } = body

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'Konu ve açıklama zorunludur' },
        { status: 400 }
      )
    }

    const ticketNumber = await generateTicketNumber()
    const now = new Date()
    const sla = calculateSLA(priority, now)

    // Kategori varsayılan atama kontrolü
    let assignedTo = null
    let assignedToName = null
    let assignedTeamId = null

    if (categoryId) {
      const category = await prisma.ticketCategory.findUnique({
        where: { id: categoryId },
        select: {
          defaultAssigneeEmail: true,
          defaultTeamId: true,
        }
      })

      if (category?.defaultAssigneeEmail) {
        assignedTo = category.defaultAssigneeEmail
        // LDAP'tan isim alınabilir
      }
      if (category?.defaultTeamId) {
        assignedTeamId = category.defaultTeamId
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject: subject.trim(),
        description: description.trim(),
        ticketType,
        categoryId,
        priority,
        impact,
        urgency,
        status: assignedTo ? 'ASSIGNED' : 'NEW',
        requesterEmail: session.user.email,
        requesterName: session.user.name,
        requesterDept: session.user.department || null,
        location,
        assetInfo,
        assignedTo,
        assignedToName,
        assignedTeamId,
        slaResponseDue: sla.slaResponseDue,
        slaResolutionDue: sla.slaResolutionDue,
        attachments: attachments ? JSON.stringify(attachments) : null,
        source: 'WEB_PORTAL',
      },
      include: {
        category: true,
      }
    })

    // Timeline kaydı
    await prisma.ticketTimeline.create({
      data: {
        ticketId: ticket.id,
        action: 'created',
        description: 'Ticket oluşturuldu',
        performedBy: session.user.email,
        performedByName: session.user.name,
      }
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('Ticket oluşturma hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
