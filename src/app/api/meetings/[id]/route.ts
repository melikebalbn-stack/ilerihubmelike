import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { toplantiKullaniciIdCoz } from '@/lib/meetings/kullanici-coz'
import {
  toplantiHataYaniti, enumDogrula, TOPLANTI_TURLERI, TOPLANTI_DURUMLARI,
} from '@/lib/meetings/hata'

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

// GET - Toplantı detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireUser — yönetici/organizer/attendee kontrolü
    const { user: currentUser, error } = await requireUser()
    if (error) return error

    const { id } = await params

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
        },
        attachments: {
          include: {
            uploadedBy: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        previousMeeting: {
          select: { id: true, meetingNumber: true, title: true }
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
        { error: 'Bu toplantıyı görüntüleme yetkiniz yok' },
        { status: 403 }
      )
    }

    return NextResponse.json(meeting)
  } catch (error) {
    return toplantiHataYaniti('meetings/[id]/GET', error)
  }
}

// PUT - Toplantı güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireUser — yönetici/organizer kontrolü, minutesApprovedById = currentUser.id
    const { user: currentUser, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { organizerId: true, status: true }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Toplantı bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü
    const isManagement = currentUser.role && MANAGEMENT_ROLES.includes(currentUser.role)
    const isOrganizer = meeting.organizerId === currentUser.id

    if (!isManagement && !isOrganizer) {
      return NextResponse.json(
        { error: 'Bu toplantıyı düzenleme yetkiniz yok' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      meetingType,
      scheduledDate,
      startTime,
      endTime,
      duration,
      location,
      isOnline,
      onlineLink,
      chairmanId,
      chairmanEmail,
      rapporteurId,
      rapporteurEmail,
      department,
      status,
      openingRemarks,
      closingRemarks,
      generalNotes,
      minutesApproved
    } = body

    // Enum'lar Prisma'ya GİTMEDEN doğrulanır (POST ucuyla aynı kural).
    const turKontrol = enumDogrula('meetingType', meetingType, TOPLANTI_TURLERI)
    if (!turKontrol.ok) return turKontrol.yanit
    const durumKontrol = enumDogrula('status', status, TOPLANTI_DURUMLARI)
    if (!durumKontrol.ok) return durumKontrol.yanit

    const updateData: Record<string, unknown> = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (meetingType !== undefined) updateData.meetingType = meetingType
    if (scheduledDate !== undefined) updateData.scheduledDate = new Date(scheduledDate)
    if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null
    if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null
    if (duration !== undefined) updateData.duration = duration
    if (location !== undefined) updateData.location = location
    if (isOnline !== undefined) updateData.isOnline = isOnline
    if (onlineLink !== undefined) updateData.onlineLink = onlineLink

    // Chairman / Rapporteur — ortak çözücü (e-posta VEYA gerçek User.id).
    // Legacy `chairmanId`/`rapporteurId` dalı eskiden değeri doğrudan yazıyordu;
    // LDAP id'si geldiğinde aynı FK ihlalini üretebilirdi. Artık o dal da
    // varlık kontrolünden geçiyor, çözülemezse null yazılıyor.
    if (chairmanEmail !== undefined || chairmanId !== undefined) {
      updateData.chairmanId = await toplantiKullaniciIdCoz(prisma, chairmanEmail ?? chairmanId)
    }
    if (rapporteurEmail !== undefined || rapporteurId !== undefined) {
      updateData.rapporteurId = await toplantiKullaniciIdCoz(prisma, rapporteurEmail ?? rapporteurId)
    }

    if (department !== undefined) updateData.department = department
    if (status !== undefined) updateData.status = status
    if (openingRemarks !== undefined) updateData.openingRemarks = openingRemarks
    if (closingRemarks !== undefined) updateData.closingRemarks = closingRemarks
    if (generalNotes !== undefined) updateData.generalNotes = generalNotes

    // Tutanak onayı
    if (minutesApproved !== undefined) {
      updateData.minutesApproved = minutesApproved
      if (minutesApproved) {
        updateData.minutesApprovedAt = new Date()
        updateData.minutesApprovedById = currentUser.id
      } else {
        updateData.minutesApprovedAt = null
        updateData.minutesApprovedById = null
      }
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { id },
      data: updateData,
      include: {
        organizer: {
          select: { id: true, name: true, email: true }
        },
        chairman: {
          select: { id: true, name: true }
        },
        rapporteur: {
          select: { id: true, name: true }
        },
        attendees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, department: true }
            }
          }
        },
        agendaItems: {
          orderBy: { orderNo: 'asc' }
        },
        decisions: {
          include: {
            responsible: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    return NextResponse.json(updatedMeeting)
  } catch (error) {
    return toplantiHataYaniti('meetings/[id]/PUT', error)
  }
}

// DELETE - Toplantı sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireUser — admin/organizer kontrolü
    const { user: currentUser, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { organizerId: true, status: true }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Toplantı bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü - Sadece organizatör veya admin silebilir
    const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN'
    const isOrganizer = meeting.organizerId === currentUser.id

    if (!isAdmin && !isOrganizer) {
      return NextResponse.json(
        { error: 'Bu toplantıyı silme yetkiniz yok' },
        { status: 403 }
      )
    }

    // Tamamlanmış toplantılar silinemez
    if (meeting.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Tamamlanmış toplantılar silinemez' },
        { status: 400 }
      )
    }

    await prisma.meeting.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Toplantı silindi' })
  } catch (error) {
    return toplantiHataYaniti('meetings/[id]/DELETE', error)
  }
}
