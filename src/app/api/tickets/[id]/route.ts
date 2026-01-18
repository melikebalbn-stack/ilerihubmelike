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

// GET - Ticket detayı
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
    const userIsITStaff = isITStaff(session.user.role, session.user.department || null)

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        assignedTeam: true,
        parentTicket: {
          select: { id: true, ticketNumber: true, subject: true }
        },
        childTickets: {
          select: { id: true, ticketNumber: true, subject: true, status: true }
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          where: userIsITStaff ? {} : { isInternal: false }
        },
        timeline: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        workLogs: userIsITStaff ? {
          orderBy: { createdAt: 'desc' },
        } : false,
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Ticket detay hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// PUT - Ticket güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const userIsITStaff = isITStaff(session.user.role, session.user.department || null)

    const existingTicket = await prisma.ticket.findUnique({
      where: { id }
    })

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü: Normal kullanıcılar sadece kendi ticket'larını güncelleyebilir
    const isOwner = existingTicket.requesterEmail === session.user.email
    if (!userIsITStaff && !isOwner) {
      return NextResponse.json({ error: 'Bu ticket\'ı güncelleme yetkiniz yok' }, { status: 403 })
    }

    const {
      subject,
      description,
      categoryId,
      priority,
      status,
      ticketType,
      assignedTo,
      assignedToName,
      assignedTeamId,
      resolutionSummary,
      rootCause,
      satisfactionRating,
      satisfactionComment,
    } = body

    // Normal kullanıcılar sadece belirli alanları güncelleyebilir
    if (!userIsITStaff) {
      // Normal kullanıcı sadece memnuniyet puanı verebilir ve ticket'ı iptal edebilir
      if (status && !['CANCELLED'].includes(status)) {
        return NextResponse.json({ error: 'Durum değiştirme yetkiniz yok' }, { status: 403 })
      }
      if (assignedTo !== undefined || assignedTeamId !== undefined) {
        return NextResponse.json({ error: 'Atama yapma yetkiniz yok' }, { status: 403 })
      }
      if (priority !== undefined) {
        return NextResponse.json({ error: 'Öncelik değiştirme yetkiniz yok' }, { status: 403 })
      }
      if (ticketType !== undefined) {
        return NextResponse.json({ error: 'Talep tipi değiştirme yetkiniz yok' }, { status: 403 })
      }
    }

    const updateData: Record<string, unknown> = {}
    const timelineEntries: Array<{
      action: string
      description: string
      oldValue?: string
      newValue?: string
    }> = []

    // Değişiklikleri takip et
    if (subject !== undefined && subject !== existingTicket.subject) {
      updateData.subject = subject
      timelineEntries.push({
        action: 'subject_changed',
        description: 'Konu değiştirildi',
        oldValue: existingTicket.subject,
        newValue: subject,
      })
    }

    if (description !== undefined && description !== existingTicket.description) {
      updateData.description = description
      timelineEntries.push({
        action: 'description_changed',
        description: 'Açıklama güncellendi',
      })
    }

    if (categoryId !== undefined && categoryId !== existingTicket.categoryId) {
      updateData.categoryId = categoryId
      timelineEntries.push({
        action: 'category_changed',
        description: 'Kategori değiştirildi',
      })
    }

    if (priority !== undefined && priority !== existingTicket.priority) {
      updateData.priority = priority
      timelineEntries.push({
        action: 'priority_changed',
        description: 'Öncelik değiştirildi',
        oldValue: existingTicket.priority,
        newValue: priority,
      })
    }

    if (ticketType !== undefined && ticketType !== existingTicket.ticketType) {
      updateData.ticketType = ticketType
      const typeLabels: Record<string, string> = {
        INCIDENT: 'Olay',
        SERVICE_REQUEST: 'Hizmet Talebi',
        PROBLEM: 'Problem',
        CHANGE_REQUEST: 'Değişiklik Talebi',
      }
      timelineEntries.push({
        action: 'ticket_type_changed',
        description: 'Talep tipi değiştirildi',
        oldValue: typeLabels[existingTicket.ticketType] || existingTicket.ticketType,
        newValue: typeLabels[ticketType] || ticketType,
      })
    }

    if (status !== undefined && status !== existingTicket.status) {
      updateData.status = status
      timelineEntries.push({
        action: 'status_changed',
        description: 'Durum değiştirildi',
        oldValue: existingTicket.status,
        newValue: status,
      })

      // İlk yanıt zamanı
      if (!existingTicket.respondedAt && ['ASSIGNED', 'IN_PROGRESS'].includes(status)) {
        updateData.respondedAt = new Date()

        // SLA ihlali kontrolü
        if (existingTicket.slaResponseDue && new Date() > existingTicket.slaResponseDue) {
          updateData.slaResponseBreached = true
        }
      }

      // Çözüm zamanı
      if (status === 'RESOLVED' && !existingTicket.resolvedAt) {
        updateData.resolvedAt = new Date()

        // SLA ihlali kontrolü
        if (existingTicket.slaResolutionDue && new Date() > existingTicket.slaResolutionDue) {
          updateData.slaResolutionBreached = true
        }
      }

      // Kapanış zamanı
      if (status === 'CLOSED' && !existingTicket.closedAt) {
        updateData.closedAt = new Date()
      }

      // Yeniden açılma
      if (status === 'REOPENED') {
        updateData.resolvedAt = null
        updateData.closedAt = null
      }
    }

    if (assignedTo !== undefined && assignedTo !== existingTicket.assignedTo) {
      updateData.assignedTo = assignedTo
      updateData.assignedToName = assignedToName || null

      // Atandığında durumu güncelle
      if (assignedTo && existingTicket.status === 'NEW') {
        updateData.status = 'ASSIGNED'
      }

      timelineEntries.push({
        action: 'assigned',
        description: assignedTo ? `${assignedToName || assignedTo} kişisine atandı` : 'Atama kaldırıldı',
      })
    }

    if (assignedTeamId !== undefined && assignedTeamId !== existingTicket.assignedTeamId) {
      updateData.assignedTeamId = assignedTeamId
      timelineEntries.push({
        action: 'team_assigned',
        description: 'Ekip ataması değiştirildi',
      })
    }

    if (resolutionSummary !== undefined) {
      updateData.resolutionSummary = resolutionSummary
    }

    if (rootCause !== undefined) {
      updateData.rootCause = rootCause
    }

    if (satisfactionRating !== undefined) {
      updateData.satisfactionRating = satisfactionRating
      updateData.satisfactionComment = satisfactionComment || null
      timelineEntries.push({
        action: 'satisfaction_rated',
        description: `Memnuniyet puanı: ${satisfactionRating}/5`,
      })
    }

    // Güncelle
    const ticket = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        assignedTeam: true,
      }
    })

    // Timeline kayıtları oluştur
    for (const entry of timelineEntries) {
      await prisma.ticketTimeline.create({
        data: {
          ticketId: id,
          action: entry.action,
          description: entry.description,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          performedBy: session.user.email,
          performedByName: session.user.name,
        }
      })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Ticket güncelleme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// DELETE - Ticket sil (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece admin silebilir
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    await prisma.ticket.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ticket silme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
