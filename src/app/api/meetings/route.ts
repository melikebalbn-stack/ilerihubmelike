import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Toplantı numarası oluştur
async function generateMeetingNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TPL-${year}-`

  const lastMeeting = await prisma.meeting.findFirst({
    where: {
      meetingNumber: { startsWith: prefix }
    },
    orderBy: { meetingNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastMeeting) {
    const lastNumber = parseInt(lastMeeting.meetingNumber.split('-')[2])
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

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

// GET - Toplantıları listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const department = searchParams.get('department')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, department: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Filtre oluştur
    const where: Record<string, unknown> = {}

    // Yönetici değilse sadece kendi katıldığı veya organize ettiği toplantıları görsün
    const isManagement = currentUser.role && MANAGEMENT_ROLES.includes(currentUser.role)
    if (!isManagement) {
      where.OR = [
        { organizerId: currentUser.id },
        { attendees: { some: { userId: currentUser.id } } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (type) {
      where.meetingType = type
    }

    if (department) {
      where.department = department
    }

    if (startDate) {
      where.scheduledDate = {
        ...(where.scheduledDate as object || {}),
        gte: new Date(startDate)
      }
    }

    if (endDate) {
      where.scheduledDate = {
        ...(where.scheduledDate as object || {}),
        lte: new Date(endDate)
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { meetingNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const total = await prisma.meeting.count({ where })

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        organizer: {
          select: { id: true, name: true, email: true, department: true }
        },
        chairman: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            attendees: true,
            agendaItems: true,
            decisions: true
          }
        }
      },
      orderBy: { scheduledDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({
      meetings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Toplantılar yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni toplantı oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, department: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      meetingType = 'OTHER',
      scheduledDate,
      startTime,
      endTime,
      location,
      isOnline = false,
      onlineLink,
      chairmanEmail,
      rapporteurEmail,
      // Legacy support for direct IDs (won't work with LDAP distinguishedName)
      chairmanId: legacyChairmanId,
      rapporteurId: legacyRapporteurId,
      department,
      attendees = [],
      agendaItems = []
    } = body

    if (!title || !scheduledDate) {
      return NextResponse.json(
        { error: 'Toplantı başlığı ve tarihi zorunludur' },
        { status: 400 }
      )
    }

    // Chairman ve Rapporteur için email'den database ID'ye çevir
    let resolvedChairmanId: string | null = null
    let resolvedRapporteurId: string | null = null

    if (chairmanEmail) {
      const chairmanUser = await prisma.user.findUnique({
        where: { email: chairmanEmail },
        select: { id: true }
      })
      resolvedChairmanId = chairmanUser?.id || null
    }

    if (rapporteurEmail) {
      const rapporteurUser = await prisma.user.findUnique({
        where: { email: rapporteurEmail },
        select: { id: true }
      })
      resolvedRapporteurId = rapporteurUser?.id || null
    }

    const meetingNumber = await generateMeetingNumber()

    // Transaction ile toplantı ve ilişkili verileri oluştur
    const meeting = await prisma.$transaction(async (tx) => {
      const newMeeting = await tx.meeting.create({
        data: {
          meetingNumber,
          title,
          description,
          meetingType,
          scheduledDate: new Date(scheduledDate),
          startTime: startTime ? new Date(startTime) : null,
          endTime: endTime ? new Date(endTime) : null,
          location,
          isOnline,
          onlineLink,
          organizerId: currentUser.id,
          chairmanId: resolvedChairmanId,
          rapporteurId: resolvedRapporteurId,
          department: department || currentUser.department,
          status: 'PLANNED'
        }
      })

      // Katılımcıları ekle
      if (attendees.length > 0) {
        for (const attendee of attendees) {
          // Internal kullanıcı için email'den database ID'ye çevir
          let resolvedUserId: string | null = null
          let fallbackName: string | null = null
          let fallbackDepartment: string | null = null
          let fallbackTitle: string | null = null

          if (attendee.userEmail) {
            const user = await tx.user.findUnique({
              where: { email: attendee.userEmail },
              select: { id: true }
            })
            resolvedUserId = user?.id || null

            // Kullanıcı DB'de yoksa LDAP bilgilerini fallback olarak kullan
            if (!resolvedUserId) {
              if (attendee.userName) fallbackName = attendee.userName
              if (attendee.userDepartment) fallbackDepartment = attendee.userDepartment
              if (attendee.userJobTitle) fallbackTitle = attendee.userJobTitle
            }
          }

          await tx.meetingAttendee.create({
            data: {
              meetingId: newMeeting.id,
              userId: resolvedUserId,
              // DB'de olmayan LDAP kullanıcıları için bilgilerini external alanlara kaydet
              externalName: attendee.externalName || fallbackName || null,
              externalEmail: attendee.externalEmail || (fallbackName ? attendee.userEmail : null),
              externalCompany: attendee.externalCompany || fallbackDepartment || null,
              externalTitle: attendee.externalTitle || fallbackTitle || null,
              role: attendee.role || 'PARTICIPANT',
              inviteStatus: 'PENDING'
            }
          })
        }
      }

      // Gündem maddelerini ekle
      if (agendaItems.length > 0) {
        for (let i = 0; i < agendaItems.length; i++) {
          const item = agendaItems[i]
          await tx.meetingAgendaItem.create({
            data: {
              meetingId: newMeeting.id,
              orderNo: i + 1,
              title: item.title,
              description: item.description || null,
              presenterId: item.presenterId || null,
              presenterName: item.presenterName || null,
              plannedDuration: item.plannedDuration || null,
              status: 'PENDING'
            }
          })
        }
      }

      return newMeeting
    })

    // Oluşturulan toplantıyı ilişkileriyle birlikte getir
    const meetingWithRelations = await prisma.meeting.findUnique({
      where: { id: meeting.id },
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
        }
      }
    })

    return NextResponse.json(meetingWithRelations, { status: 201 })
  } catch (error) {
    console.error('Toplantı oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
