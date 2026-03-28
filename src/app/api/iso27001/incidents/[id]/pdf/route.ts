import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateIncidentReportPDFBuffer, IncidentForPDF } from "@/lib/pdf/incident-report-pdf"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const { id } = await params

    // İmzalayan kullanıcı bilgilerini al
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, jobTitle: true, role: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
    }

    const incident = await prisma.iso27001Incident.findUnique({
      where: { id },
      include: {
        reportedBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        timeline: {
          orderBy: { performedAt: "desc" },
        },
      },
    })

    if (!incident) {
      return NextResponse.json({ error: "Olay bulunamadı" }, { status: 404 })
    }

    // Incident verisini PDF formatına dönüştür
    const incidentForPDF: IncidentForPDF = {
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      severity: incident.severity,
      status: incident.status,
      detectedAt: incident.detectedAt.toISOString(),
      detectionMethod: incident.detectionMethod,
      reportedAt: incident.reportedAt.toISOString(),
      containmentAt: incident.containmentAt?.toISOString() || null,
      resolvedAt: incident.resolvedAt?.toISOString() || null,
      closedAt: incident.closedAt?.toISOString() || null,
      reportedByName: incident.reportedBy?.name || incident.reportedByName || "Bilinmiyor",
      reportedByEmail: incident.reportedBy?.email || "",
      assignedToName: incident.assignedTo?.name || null,
      assignedToEmail: incident.assignedTo?.email || null,
      affectedSystems: incident.affectedSystems,
      affectedAssets: incident.affectedAssets,
      impactScope: incident.impactScope,
      immediateActions: incident.immediateActions,
      rootCause: incident.rootCause,
      rootCauseAnalyzedAt: incident.rootCauseAnalyzedAt?.toISOString() || null,
      resolution: incident.resolution,
      correctiveAction: incident.correctiveAction,
      preventiveAction: incident.preventiveAction,
      closureNotes: incident.closureNotes,
      lessonsLearned: incident.lessonsLearned,
      relatedControls: incident.relatedControls,
      relatedRiskIds: incident.relatedRiskIds,
      timeline: incident.timeline.map((t) => ({
        action: t.action,
        description: t.description,
        performedByName: t.performedByName,
        performedAt: t.performedAt.toISOString(),
      })),
      signerName: currentUser.name || currentUser.email,
      signerEmail: currentUser.email,
      signerTitle: currentUser.jobTitle || "BGYS Sorumlusu",
    }

    // PDF oluştur
    const pdfBuffer = generateIncidentReportPDFBuffer(incidentForPDF)

    // Dosya adını oluştur
    const fileName = `Olay_Raporu_${incident.incidentNumber.replace(/[/\\?%*:|"<>]/g, "-")}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("Olay PDF oluşturulurken hata:", error)
    return NextResponse.json({ error: "PDF oluşturulamadı" }, { status: 500 })
  }
}
