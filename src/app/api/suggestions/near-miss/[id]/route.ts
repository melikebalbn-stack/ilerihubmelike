import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NearMissStatus } from '@/generated/prisma'

// GET - Ramak kala detayı
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

    const report = await prisma.nearMiss.findUnique({
      where: { id },
      include: {
        attachments: {
          orderBy: { createdAt: 'desc' }
        },
        actions: {
          orderBy: { createdAt: 'desc' }
        },
        timeline: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Bildirim bulunamadı' }, { status: 404 })
    }

    // Anonim bildirimlerde gönderen bilgisini gizle
    if (report.isAnonymous && report.reportedBy !== session.user.email) {
      return NextResponse.json({
        ...report,
        reportedBy: 'anonim@ilerigroup.com',
        reportedByName: 'Anonim',
        reportedByDept: null
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Ramak kala bildirimi yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Ramak kala bildirimini güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existingReport = await prisma.nearMiss.findUnique({
      where: { id }
    })

    if (!existingReport) {
      return NextResponse.json({ error: 'Bildirim bulunamadı' }, { status: 404 })
    }

    const {
      title,
      description,
      eventLocation,
      locationDetails,
      eventType,
      potentialSeverity,
      whatHappened,
      whyHappened,
      howHappened,
      affectedPersons,
      affectedEquipment,
      status,
      investigationNotes,
      rootCause,
      rootCauseCategory,
      assignedTo,
      assignedToName,
      assignedDept,
      closureNotes
    } = body

    const oldStatus = existingReport.status
    const newStatus = status as NearMissStatus | undefined

    // Kapanış işlemi
    let closedAt = existingReport.closedAt
    let closedBy = existingReport.closedBy
    let closedByName = existingReport.closedByName

    if (newStatus === 'CLOSED' && oldStatus !== 'CLOSED') {
      closedAt = new Date()
      closedBy = session.user.email
      closedByName = session.user.name || 'Bilinmiyor'
    }

    const report = await prisma.nearMiss.update({
      where: { id },
      data: {
        title,
        description,
        eventLocation,
        locationDetails,
        eventType,
        potentialSeverity,
        whatHappened,
        whyHappened,
        howHappened,
        affectedPersons,
        affectedEquipment,
        status: newStatus,
        investigationNotes,
        rootCause,
        rootCauseCategory,
        assignedTo,
        assignedToName,
        assignedDept,
        closureNotes,
        closedAt,
        closedBy,
        closedByName
      },
      include: {
        attachments: true,
        actions: true
      }
    })

    // Durum değişikliği varsa timeline'a ekle
    if (newStatus && oldStatus !== newStatus) {
      const statusLabels: Record<string, string> = {
        REPORTED: 'Bildirildi',
        UNDER_INVESTIGATION: 'Araştırılıyor',
        ACTION_REQUIRED: 'Aksiyon Gerekli',
        IN_PROGRESS: 'İşlemde',
        RESOLVED: 'Çözüldü',
        CLOSED: 'Kapatıldı'
      }

      await prisma.nearMissTimeline.create({
        data: {
          nearMissId: id,
          action: 'STATUS_CHANGED',
          description: `Durum değiştirildi: ${statusLabels[newStatus]}`,
          performedBy: session.user.email,
          performedByName: session.user.name || 'Bilinmiyor',
          oldStatus,
          newStatus
        }
      })
    }

    // Atama yapıldıysa timeline'a ekle
    if (assignedTo && assignedTo !== existingReport.assignedTo) {
      await prisma.nearMissTimeline.create({
        data: {
          nearMissId: id,
          action: 'ASSIGNED',
          description: `${assignedToName || assignedTo} kişisine atandı`,
          performedBy: session.user.email,
          performedByName: session.user.name || 'Bilinmiyor'
        }
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Ramak kala bildirimi güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Ramak kala bildirimini sil (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existingReport = await prisma.nearMiss.findUnique({
      where: { id }
    })

    if (!existingReport) {
      return NextResponse.json({ error: 'Bildirim bulunamadı' }, { status: 404 })
    }

    // Sadece bildiren kişi silebilir ve sadece REPORTED durumunda
    if (existingReport.reportedBy !== session.user.email) {
      return NextResponse.json({ error: 'Bu bildirimi silme yetkiniz yok' }, { status: 403 })
    }

    if (existingReport.status !== 'REPORTED') {
      return NextResponse.json(
        { error: 'İşleme alınan bildirimler silinemez' },
        { status: 400 }
      )
    }

    await prisma.nearMiss.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ramak kala bildirimi silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
