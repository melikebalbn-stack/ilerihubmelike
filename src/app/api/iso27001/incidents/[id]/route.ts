import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Olay detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params

    const incident = await prisma.iso27001Incident.findUnique({
      where: { id },
      include: {
        reportedBy: {
          select: { id: true, name: true, email: true, department: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, department: true },
        },
        attachments: true,
        actions: {
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        timeline: {
          orderBy: { performedAt: "desc" },
        },
      },
    })

    if (!incident) {
      return NextResponse.json({ error: "Olay bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(incident)
  } catch (error) {
    console.error("Olay detay hatasi:", error)
    return NextResponse.json(
      { error: "Olay alinamadi" },
      { status: 500 }
    )
  }
}

// Olay güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Kullanici bulunamadi" }, { status: 404 })
    }

    // Mevcut olayı al
    const existingIncident = await prisma.iso27001Incident.findUnique({
      where: { id },
    })

    if (!existingIncident) {
      return NextResponse.json({ error: "Olay bulunamadi" }, { status: 404 })
    }

    const {
      status,
      severity,
      assignedToId,
      immediateActions,
      containmentAt,
      rootCause,
      resolution,
      closureNotes,
      lessonsLearned,
    } = body

    const updateData: any = {}
    const timelineEntries: any[] = []

    // Durum değişikliği
    if (status && status !== existingIncident.status) {
      updateData.status = status

      switch (status) {
        case "ANALYZING":
          timelineEntries.push({
            action: "Inceleme baslatildi",
            description: `Olay incelemeye alindi`,
          })
          break
        case "CONTAINED":
          updateData.containmentAt = containmentAt || new Date()
          timelineEntries.push({
            action: "Kontrol altina alindi",
            description: `Olay kontrol altina alindi`,
          })
          break
        case "RESOLVING":
          timelineEntries.push({
            action: "Cozum sureci baslatildi",
            description: `Olay cozum surecine alindi`,
          })
          break
        case "RESOLVED":
          updateData.resolvedAt = new Date()
          updateData.resolvedById = user.id
          if (resolution) updateData.resolution = resolution
          timelineEntries.push({
            action: "Olay cozuldu",
            description: resolution || "Olay basariyla cozuldu",
          })
          break
        case "CLOSED":
          updateData.closedAt = new Date()
          updateData.closedById = user.id
          if (closureNotes) updateData.closureNotes = closureNotes
          if (lessonsLearned) updateData.lessonsLearned = lessonsLearned
          timelineEntries.push({
            action: "Olay kapatildi",
            description: closureNotes || "Olay kapatildi",
          })
          break
      }
    }

    // Diğer alanlar
    if (severity && severity !== existingIncident.severity) {
      updateData.severity = severity
      timelineEntries.push({
        action: "Siddet degistirildi",
        description: `${existingIncident.severity} -> ${severity}`,
      })
    }

    if (assignedToId !== undefined && assignedToId !== existingIncident.assignedToId) {
      updateData.assignedToId = assignedToId || null
      if (assignedToId) {
        const assignee = await prisma.user.findUnique({
          where: { id: assignedToId },
          select: { name: true },
        })
        timelineEntries.push({
          action: "Sorumluluk atandi",
          description: `${assignee?.name || "Bilinmeyen"} sorumlu olarak atandi`,
        })
      }
    }

    if (immediateActions) updateData.immediateActions = immediateActions
    if (rootCause) {
      updateData.rootCause = rootCause
      updateData.rootCauseAnalyzedAt = new Date()
      timelineEntries.push({
        action: "Kok neden analizi tamamlandi",
        description: rootCause,
      })
    }
    if (resolution) updateData.resolution = resolution
    if (closureNotes) updateData.closureNotes = closureNotes
    if (lessonsLearned) updateData.lessonsLearned = lessonsLearned

    // Olay güncelle
    const incident = await prisma.iso27001Incident.update({
      where: { id },
      data: updateData,
      include: {
        reportedBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Timeline kayıtları oluştur
    if (timelineEntries.length > 0) {
      await prisma.iso27001IncidentTimeline.createMany({
        data: timelineEntries.map(entry => ({
          incidentId: id,
          action: entry.action,
          description: entry.description,
          performedById: user.id,
          performedByName: user.name,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      incident,
    })
  } catch (error) {
    console.error("Olay guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Olay guncellenemedi" },
      { status: 500 }
    )
  }
}

// Olay sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params

    await prisma.iso27001Incident.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Olay silme hatasi:", error)
    return NextResponse.json(
      { error: "Olay silinemedi" },
      { status: 500 }
    )
  }
}
