import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Ticket yorumları
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params
    // FIX #18: IT_MANAGER da internal yorumları görebilir
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'IT_MANAGER'].includes(session.user.role || '')

    const comments = await prisma.ticketComment.findMany({
      where: {
        ticketId,
        // Admin değilse dahili notları gösterme
        ...(isAdmin ? {} : { isInternal: false })
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Yorumlar getirilemedi:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// POST - Yeni yorum ekle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const body = await request.json()
    const { content, isInternal = false, isResolution = false, attachments } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Yorum içeriği zorunludur' }, { status: 400 })
    }

    // Ticket'ı kontrol et
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    // Sadece admin/IT yöneticisi dahili not ekleyebilir
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'IT_MANAGER'].includes(session.user.role || '')
    const finalIsInternal = isAdmin ? isInternal : false

    // Yorum oluştur
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorEmail: session.user.email,
        authorName: session.user.name,
        content: content.trim(),
        isInternal: finalIsInternal,
        isResolution,
        attachments: attachments ? JSON.stringify(attachments) : null,
      }
    })

    // Timeline kaydı
    await prisma.ticketTimeline.create({
      data: {
        ticketId,
        action: finalIsInternal ? 'internal_note_added' : 'comment_added',
        description: finalIsInternal ? 'Dahili not eklendi' : 'Yorum eklendi',
        performedBy: session.user.email,
        performedByName: session.user.name,
      }
    })

    // İlk yanıt kontrolü (IT personeli yanıt verdiyse)
    if (isAdmin && !ticket.respondedAt) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          respondedAt: new Date(),
          slaResponseBreached: ticket.slaResponseDue ? new Date() > ticket.slaResponseDue : false,
        }
      })
    }

    // Çözüm notu ise durumu güncelle
    if (isResolution && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolutionSummary: content.trim(),
          slaResolutionBreached: ticket.slaResolutionDue ? new Date() > ticket.slaResolutionDue : false,
        }
      })

      // Timeline kaydı
      await prisma.ticketTimeline.create({
        data: {
          ticketId,
          action: 'status_changed',
          description: 'Durum değiştirildi',
          oldValue: ticket.status,
          newValue: 'RESOLVED',
          performedBy: session.user.email,
          performedByName: session.user.name,
        }
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Yorum ekleme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
