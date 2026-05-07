import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { requireUser } from "@/lib/auth/require-user"

// Yonetim gozden gecirme listesi
export async function GET() {
  try {
    // PR-Y2.5-iso27001-C: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

    const reviews = await prisma.iso27001ManagementReview.findMany({
      orderBy: { reviewDate: "desc" },
    })

    // Frontend icin donustur
    const formatted = reviews.map(r => {
      let attendees: string[] = []
      try {
        const parsed = r.participants ? JSON.parse(r.participants) : []
        attendees = parsed.map((p: unknown) =>
          typeof p === "string" ? p : (p as { name?: string; title?: string }).name || String(p)
        )
      } catch { attendees = [] }

      return {
      id: r.id,
      reviewNumber: r.reviewNumber,
      title: r.title,
      description: null,
      meetingDate: r.reviewDate,
      attendees,
      agenda: [],
      status: r.status,
      auditResults: r.auditResults,
      riskAssessment: r.riskStatus,
      incidentSummary: r.incidentSummary,
      improvementStatus: r.improvements,
      resourceNeeds: r.resourceNeeds,
      decisions: r.decisions ? JSON.parse(r.decisions) : [],
      actionItems: r.actionItems ? JSON.parse(r.actionItems) : [],
      nextReviewDate: null,
      conclusion: null,
      minutesUrl: r.minutesUrl,
      chairperson: r.chairperson,
      createdAt: r.createdAt,
    }})

    return NextResponse.json(formatted)
  } catch (error) {
    console.error("Toplanti listesi hatasi:", error)
    return NextResponse.json(
      { error: "Toplantilar alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni toplanti olustur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-C: requireUser — chairperson default user.name fallback
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()
    const {
      title,
      meetingDate,
      attendees,
      chairperson,
    } = body

    if (!title || !meetingDate) {
      return NextResponse.json(
        { error: "Baslik ve toplanti tarihi zorunludur" },
        { status: 400 }
      )
    }

    // Toplanti numarasi olustur: ISO-MGT-YYYY-QX
    const date = new Date(meetingDate)
    const year = date.getFullYear()
    const quarter = Math.ceil((date.getMonth() + 1) / 3)

    const lastReview = await prisma.iso27001ManagementReview.findFirst({
      where: {
        reviewNumber: {
          startsWith: `ISO-MGT-${year}`,
        },
      },
      orderBy: { reviewNumber: "desc" },
      select: { reviewNumber: true },
    })

    let nextNum = 1
    if (lastReview) {
      const parts = lastReview.reviewNumber.split("-")
      const lastNum = parseInt(parts[parts.length - 1].replace("Q", ""))
      nextNum = lastNum + 1
    }
    const reviewNumber = `ISO-MGT-${year}-Q${quarter}`

    const review = await prisma.iso27001ManagementReview.create({
      data: {
        reviewNumber,
        title,
        reviewDate: new Date(meetingDate),
        participants: JSON.stringify(attendees || []),
        chairperson: chairperson || user.name || "",
        status: "DRAFT",
      },
    })

    return NextResponse.json({
      success: true,
      review,
      message: "Toplanti olusturuldu",
    })
  } catch (error) {
    console.error("Toplanti olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Toplanti olusturulamadi" },
      { status: 500 }
    )
  }
}
