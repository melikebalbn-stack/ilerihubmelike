import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendPushToUser } from "@/lib/push-notifications"

// Olay listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const severity = searchParams.get("severity")
    const category = searchParams.get("category")
    const search = searchParams.get("search")

    const where: any = {}
    if (status && status !== "all") where.status = status
    if (severity && severity !== "all") where.severity = severity
    if (category && category !== "all") where.category = category
    if (search) {
      where.OR = [
        { incidentNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ]
    }

    const incidents = await prisma.iso27001Incident.findMany({
      where,
      include: {
        reportedBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        actions: {
          select: { id: true, status: true },
        },
      },
      orderBy: [
        { severity: "asc" }, // Kritik önce
        { detectedAt: "desc" },
      ],
    })

    // İstatistikler
    const stats = {
      total: incidents.length,
      open: incidents.filter(i => !["RESOLVED", "CLOSED"].includes(i.status)).length,
      critical: incidents.filter(i => i.severity === "CRITICAL" && !["RESOLVED", "CLOSED"].includes(i.status)).length,
      high: incidents.filter(i => i.severity === "HIGH" && !["RESOLVED", "CLOSED"].includes(i.status)).length,
      resolved: incidents.filter(i => i.status === "RESOLVED" || i.status === "CLOSED").length,
      thisMonth: incidents.filter(i => {
        const date = new Date(i.detectedAt)
        const now = new Date()
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      }).length,
    }

    return NextResponse.json({ incidents, stats })
  } catch (error) {
    console.error("Olay listesi hatasi:", error)
    return NextResponse.json(
      { error: "Olaylar alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni olay oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      category,
      severity,
      detectedAt,
      detectionMethod,
      affectedSystems,
      affectedAssets,
      impactScope,
      immediateActions,
      assignedToId,
      relatedControls,
      relatedRiskIds,
      correctiveAction,
      preventiveAction,
    } = body

    if (!title || !description || !category || !severity || !detectedAt) {
      return NextResponse.json(
        { error: "Zorunlu alanlar eksik" },
        { status: 400 }
      )
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Kullanici bulunamadi" }, { status: 404 })
    }

    // Olay numarası oluştur (OY-YYYY-NNN)
    const year = new Date().getFullYear()
    const count = await prisma.iso27001Incident.count({
      where: {
        incidentNumber: {
          startsWith: `OY-${year}`,
        },
      },
    })
    const incidentNumber = `OY-${year}-${String(count + 1).padStart(3, "0")}`

    // Olay oluştur
    const incident = await prisma.iso27001Incident.create({
      data: {
        incidentNumber,
        title,
        description,
        category,
        severity,
        detectedAt: new Date(detectedAt),
        detectionMethod: detectionMethod || null,
        reportedById: user.id,
        reportedByName: user.name,
        affectedSystems,
        affectedAssets,
        impactScope,
        immediateActions,
        assignedToId: assignedToId || null,
        relatedControls: relatedControls || "5.24,5.25,5.26",
        relatedRiskIds: relatedRiskIds || [],
        correctiveAction: correctiveAction || null,
        preventiveAction: preventiveAction || null,
      },
      include: {
        reportedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Timeline kaydı oluştur
    await prisma.iso27001IncidentTimeline.create({
      data: {
        incidentId: incident.id,
        action: "Olay raporlandi",
        description: `${user.name} tarafindan raporlandi. Siddet: ${severity}`,
        performedById: user.id,
        performedByName: user.name,
      },
    })

    // Kritik olaylarda bildirim gönder
    if (severity === "CRITICAL" || severity === "HIGH") {
      // IT yöneticilerine bildirim gönder
      const itManagers = await prisma.user.findMany({
        where: { role: { in: ["IT_MANAGER", "ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
      })

      const incidentNotifs = itManagers.map(m => ({
        userId: m.id,
        title: `${severity === "CRITICAL" ? "KRİTİK" : "YÜKSEK"} Güvenlik Olayı`,
        message: `${incidentNumber}: ${title}`,
        type: severity === "CRITICAL" ? "ERROR" as const : "WARNING" as const,
        link: `/iso27001/incidents/${incident.id}`,
      }))

      await prisma.notification.createMany({ data: incidentNotifs })

      // Push bildirim gönder
      for (const notif of incidentNotifs) {
        sendPushToUser(prisma, notif.userId, {
          title: notif.title,
          body: notif.message,
          url: notif.link,
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      incident,
    })
  } catch (error) {
    console.error("Olay olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Olay olusturulamadi" },
      { status: 500 }
    )
  }
}
