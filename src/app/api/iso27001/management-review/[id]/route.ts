import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Tekil toplanti detayi
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

    const review = await prisma.iso27001ManagementReview.findUnique({
      where: { id },
    })

    if (!review) {
      return NextResponse.json({ error: "Toplanti bulunamadi" }, { status: 404 })
    }

    // Katilimcilari parse et
    let attendees: { name: string; title: string; role: string }[] = []
    try {
      const parsed = review.participants ? JSON.parse(review.participants) : []
      attendees = parsed.map((p: unknown) => {
        if (typeof p === "string") return { name: p, title: "", role: "" }
        const obj = p as { name?: string; title?: string; role?: string }
        return { name: obj.name || String(p), title: obj.title || "", role: obj.role || "" }
      })
    } catch { attendees = [] }

    // Kararlari parse et
    let decisions: unknown[] = []
    try {
      decisions = review.decisions ? JSON.parse(review.decisions) : []
    } catch { decisions = [] }

    // Aksiyon kalemlerini parse et
    let actionItems: unknown[] = []
    try {
      actionItems = review.actionItems ? JSON.parse(review.actionItems) : []
    } catch { actionItems = [] }

    return NextResponse.json({
      id: review.id,
      reviewNumber: review.reviewNumber,
      title: review.title,
      meetingDate: review.reviewDate,
      attendees,
      status: review.status,
      chairperson: review.chairperson,
      // Girdiler
      auditResults: review.auditResults,
      feedbacks: review.feedbacks,
      incidentSummary: review.incidentSummary,
      riskAssessment: review.riskStatus,
      objectivesStatus: review.objectivesStatus,
      previousActions: review.previousActions,
      changes: review.changes,
      improvementStatus: review.improvements,
      // Ciktilar
      decisions,
      actionItems,
      resourceNeeds: review.resourceNeeds,
      // Dokuiman
      minutesUrl: review.minutesUrl,
      // Onay
      approvedById: review.approvedById,
      approvedByName: review.approvedByName,
      approvedAt: review.approvedAt,
      // Tarihler
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    })
  } catch (error) {
    console.error("Toplanti detay hatasi:", error)
    return NextResponse.json({ error: "Toplanti alinamadi" }, { status: 500 })
  }
}

// Toplanti guncelle
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

    const existing = await prisma.iso27001ManagementReview.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Toplanti bulunamadi" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) updateData.title = body.title
    if (body.meetingDate !== undefined) updateData.reviewDate = new Date(body.meetingDate)
    if (body.chairperson !== undefined) updateData.chairperson = body.chairperson
    if (body.status !== undefined) updateData.status = body.status
    if (body.attendees !== undefined) updateData.participants = JSON.stringify(body.attendees)

    // Girdi alanlari
    if (body.auditResults !== undefined) updateData.auditResults = body.auditResults
    if (body.feedbacks !== undefined) updateData.feedbacks = body.feedbacks
    if (body.incidentSummary !== undefined) updateData.incidentSummary = body.incidentSummary
    if (body.riskAssessment !== undefined) updateData.riskStatus = body.riskAssessment
    if (body.objectivesStatus !== undefined) updateData.objectivesStatus = body.objectivesStatus
    if (body.previousActions !== undefined) updateData.previousActions = body.previousActions
    if (body.changes !== undefined) updateData.changes = body.changes
    if (body.improvementStatus !== undefined) updateData.improvements = body.improvementStatus

    // Cikti alanlari
    if (body.decisions !== undefined) updateData.decisions = JSON.stringify(body.decisions)
    if (body.actionItems !== undefined) updateData.actionItems = JSON.stringify(body.actionItems)
    if (body.resourceNeeds !== undefined) updateData.resourceNeeds = body.resourceNeeds

    // Dokuman
    if (body.minutesUrl !== undefined) updateData.minutesUrl = body.minutesUrl

    const updated = await prisma.iso27001ManagementReview.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      review: updated,
      message: "Toplanti guncellendi",
    })
  } catch (error) {
    console.error("Toplanti guncelleme hatasi:", error)
    return NextResponse.json({ error: "Toplanti guncellenemedi" }, { status: 500 })
  }
}

// Toplanti sil
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

    await prisma.iso27001ManagementReview.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Toplanti silindi" })
  } catch (error) {
    console.error("Toplanti silme hatasi:", error)
    return NextResponse.json({ error: "Toplanti silinemedi" }, { status: 500 })
  }
}
