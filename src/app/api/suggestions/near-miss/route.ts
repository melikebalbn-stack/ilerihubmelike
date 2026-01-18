import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Ramak kala numarası oluştur: RMK-2025-0001
async function generateReportNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `RMK-${year}-`

  const lastReport = await prisma.nearMiss.findFirst({
    where: { reportNumber: { startsWith: prefix } },
    orderBy: { reportNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastReport) {
    const lastNumber = parseInt(lastReport.reportNumber.replace(prefix, ''))
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// GET - Ramak kala bildirimlerini listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('viewMode') || 'all'
    const status = searchParams.get('status')
    const eventType = searchParams.get('eventType')
    const severity = searchParams.get('severity')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userEmail = String(session.user.email).toLowerCase()

    const where: Record<string, unknown> = { isActive: true }

    // Kullanıcının rolünü belirle (kurul üyesi mi?)
    const boardMembers = await prisma.suggestionBoardMember.findMany({
      where: { isActive: true },
      select: { email: true },
    })
    const isBoardMember = boardMembers.some(m => m.email.toLowerCase() === userEmail)

    if (viewMode === 'my') {
      where.reportedBy = { equals: userEmail, mode: 'insensitive' }
    } else if (viewMode === 'assigned') {
      where.assignedTo = { equals: userEmail, mode: 'insensitive' }
    } else if (viewMode === 'open') {
      where.status = { in: ['REPORTED', 'UNDER_INVESTIGATION', 'ACTION_REQUIRED', 'IN_PROGRESS'] }
      // Kurul üyesi değilse sadece kendi bildirimlerini veya kendine atananları göster
      if (!isBoardMember) {
        where.OR = [
          { reportedBy: { equals: userEmail, mode: 'insensitive' } },
          { assignedTo: { equals: userEmail, mode: 'insensitive' } }
        ]
      }
    } else if (viewMode === 'all') {
      // Görünürlük kısıtlaması: Kurul üyesi tümünü görsün, diğerleri sadece kendi bildirimlerini
      if (!isBoardMember) {
        where.OR = [
          { reportedBy: { equals: userEmail, mode: 'insensitive' } },
          { assignedTo: { equals: userEmail, mode: 'insensitive' } }
        ]
      }
    }

    if (status) {
      where.status = status
    }

    if (eventType) {
      where.eventType = eventType
    }

    if (severity) {
      where.potentialSeverity = severity
    }

    const reports = await prisma.nearMiss.findMany({
      where,
      include: {
        _count: {
          select: {
            attachments: true,
            actions: true
          }
        }
      },
      orderBy: { reportedAt: 'desc' },
      take: limit
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error('Ramak kala bildirimleri yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni ramak kala bildirimi oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      eventDate,
      eventLocation,
      locationDetails,
      eventType,
      potentialSeverity,
      whatHappened,
      whyHappened,
      howHappened,
      affectedPersons,
      affectedEquipment,
      witnesses,
      isAnonymous,
      latitude,
      longitude
    } = body

    if (!title || !description || !eventLocation || !eventType || !potentialSeverity) {
      return NextResponse.json(
        { error: 'Başlık, açıklama, konum, olay tipi ve ciddiyet zorunludur' },
        { status: 400 }
      )
    }

    const reportNumber = await generateReportNumber()

    // AD'den departman bilgisini al
    let reportedByDept = null
    try {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { department: true }
      })
      reportedByDept = user?.department
    } catch {
      // Kullanıcı bulunamazsa devam et
    }

    const report = await prisma.nearMiss.create({
      data: {
        reportNumber,
        title,
        description,
        eventDate: eventDate ? new Date(eventDate) : new Date(),
        eventLocation,
        locationDetails,
        eventType,
        potentialSeverity,
        whatHappened,
        whyHappened,
        howHappened,
        affectedPersons,
        affectedEquipment,
        witnesses: witnesses ? JSON.stringify(witnesses) : null,
        reportedBy: isAnonymous ? 'anonim@ilerigroup.com' : session.user.email,
        reportedByName: isAnonymous ? 'Anonim' : (session.user.name || 'Bilinmiyor'),
        reportedByDept: isAnonymous ? null : reportedByDept,
        isAnonymous: isAnonymous || false,
        latitude,
        longitude,
        status: 'REPORTED'
      },
      include: {
        attachments: true,
        actions: true
      }
    })

    // Timeline'a ekle
    await prisma.nearMissTimeline.create({
      data: {
        nearMissId: report.id,
        action: 'REPORTED',
        description: 'Ramak kala olayı bildirildi',
        performedBy: isAnonymous ? 'anonim@ilerigroup.com' : session.user.email,
        performedByName: isAnonymous ? 'Anonim' : (session.user.name || 'Bilinmiyor'),
        newStatus: 'REPORTED'
      }
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('Ramak kala bildirimi oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
