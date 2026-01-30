import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateMeetingMinutesPDFBuffer, MeetingForPDF } from '@/lib/pdf/meeting-minutes-pdf'

// Yetki kontrolü
const MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'HR_MANAGER',
  'QUALITY_MANAGER',
  'IT_MANAGER',
  'DEPT_HEAD',
  'SUPERVISOR'
]

// GET - PDF oluştur ve indir
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

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, name: true, email: true, department: true, jobTitle: true }
        },
        chairman: {
          select: { id: true, name: true, email: true, department: true }
        },
        rapporteur: {
          select: { id: true, name: true, email: true, department: true }
        },
        minutesApprovedBy: {
          select: { id: true, name: true }
        },
        attendees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, department: true, jobTitle: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        agendaItems: {
          include: {
            presenter: {
              select: { id: true, name: true }
            }
          },
          orderBy: { orderNo: 'asc' }
        },
        decisions: {
          include: {
            responsible: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Toplantı bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü - Yönetici veya katılımcı/organizatör olmalı
    const isManagement = currentUser.role && MANAGEMENT_ROLES.includes(currentUser.role)
    const isOrganizer = meeting.organizerId === currentUser.id
    const isAttendee = meeting.attendees.some(a => a.userId === currentUser.id)

    if (!isManagement && !isOrganizer && !isAttendee) {
      return NextResponse.json(
        { error: 'Bu toplantının PDF\'ini indirme yetkiniz yok' },
        { status: 403 }
      )
    }

    // Meeting verisini PDF formatına dönüştür
    const meetingForPDF: MeetingForPDF = {
      id: meeting.id,
      meetingNumber: meeting.meetingNumber,
      title: meeting.title,
      description: meeting.description,
      meetingType: meeting.meetingType,
      scheduledDate: meeting.scheduledDate.toISOString(),
      startTime: meeting.startTime?.toISOString() || null,
      endTime: meeting.endTime?.toISOString() || null,
      location: meeting.location,
      isOnline: meeting.isOnline,
      onlineLink: meeting.onlineLink,
      status: meeting.status,
      department: meeting.department,
      openingRemarks: meeting.openingRemarks,
      closingRemarks: meeting.closingRemarks,
      generalNotes: meeting.generalNotes,
      minutesApproved: meeting.minutesApproved,
      minutesApprovedAt: meeting.minutesApprovedAt?.toISOString() || null,
      organizer: {
        id: meeting.organizer.id,
        name: meeting.organizer.name || 'Bilinmiyor',
        department: meeting.organizer.department
      },
      chairman: meeting.chairman ? {
        id: meeting.chairman.id,
        name: meeting.chairman.name || 'Bilinmiyor',
        department: meeting.chairman.department
      } : null,
      rapporteur: meeting.rapporteur ? {
        id: meeting.rapporteur.id,
        name: meeting.rapporteur.name || 'Bilinmiyor',
        department: meeting.rapporteur.department
      } : null,
      minutesApprovedBy: meeting.minutesApprovedBy ? {
        id: meeting.minutesApprovedBy.id,
        name: meeting.minutesApprovedBy.name || 'Bilinmiyor'
      } : null,
      attendees: meeting.attendees.map(att => ({
        id: att.id,
        userId: att.userId,
        externalName: att.externalName,
        externalEmail: att.externalEmail,
        externalCompany: att.externalCompany,
        externalTitle: att.externalTitle,
        role: att.role,
        attendanceStatus: att.attendanceStatus,
        user: att.user ? {
          id: att.user.id,
          name: att.user.name || 'Bilinmiyor',
          email: att.user.email,
          department: att.user.department,
          jobTitle: att.user.jobTitle
        } : null
      })),
      agendaItems: meeting.agendaItems.map(item => ({
        id: item.id,
        orderNo: item.orderNo,
        title: item.title,
        description: item.description,
        presenterName: item.presenterName,
        plannedDuration: item.plannedDuration,
        discussionNotes: item.discussionNotes,
        outcome: item.outcome,
        outcomeNotes: item.outcomeNotes,
        presenter: item.presenter ? {
          id: item.presenter.id,
          name: item.presenter.name || 'Bilinmiyor'
        } : null
      })),
      decisions: meeting.decisions.map(dec => ({
        id: dec.id,
        decisionNumber: dec.decisionNumber,
        title: dec.title,
        description: dec.description,
        responsibleId: dec.responsibleId,
        dueDate: dec.dueDate?.toISOString() || null,
        priority: dec.priority,
        status: dec.status,
        responsible: dec.responsible ? {
          id: dec.responsible.id,
          name: dec.responsible.name || 'Bilinmiyor'
        } : null
      }))
    }

    // PDF oluştur
    const pdfBuffer = generateMeetingMinutesPDFBuffer(meetingForPDF)

    // Dosya adını oluştur
    const fileName = `Toplanti_Tutanagi_${meeting.meetingNumber.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`

    // PDF'i döndür
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('PDF oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
