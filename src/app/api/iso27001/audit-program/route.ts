import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "IT_MANAGER", "QUALITY_MANAGER"]

// Program listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")

    const where: any = {}
    if (year) {
      where.year = parseInt(year)
    }

    const programs = await prisma.iso27001AuditProgram.findMany({
      where,
      orderBy: { year: "desc" },
      include: {
        auditors: {
          orderBy: { sortOrder: "asc" },
        },
        planItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    return NextResponse.json(programs)
  } catch (error) {
    console.error("Denetim programı listesi hatası:", error)
    return NextResponse.json(
      { error: "Programlar alınamadı" },
      { status: 500 }
    )
  }
}

// Yeni program oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })

    if (!currentUser?.role || !ALLOWED_ROLES.includes(currentUser.role)) {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 })
    }

    const body = await request.json()
    const {
      programNumber,
      title,
      revision,
      publishDate,
      year,
      periodStart,
      periodEnd,
      periodLabel,
      purpose,
      auditApproach,
      preparedByName,
      preparedByTitle,
      reviewedByName,
      reviewedByTitle,
      approvedByName,
      approvedByTitle,
      auditors,
      planItems,
    } = body

    if (!title || !year || !publishDate || !preparedByName) {
      return NextResponse.json(
        { error: "Başlık, yıl, yayın tarihi ve hazırlayan zorunludur" },
        { status: 400 }
      )
    }

    // Program numarası oluştur
    const finalProgramNumber = programNumber || `BGYS-DNT-${String(year).slice(-2)}${String(await prisma.iso27001AuditProgram.count() + 1).padStart(2, "0")}`

    const program = await prisma.iso27001AuditProgram.create({
      data: {
        programNumber: finalProgramNumber,
        title,
        revision: revision || "Rev.01",
        publishDate: new Date(publishDate),
        year,
        periodStart: new Date(periodStart || `${year}-01-01`),
        periodEnd: new Date(periodEnd || `${year}-12-31`),
        periodLabel: periodLabel || null,
        purpose: purpose || null,
        auditApproach: auditApproach || [],
        preparedByName,
        preparedByTitle: preparedByTitle || null,
        reviewedByName: reviewedByName || null,
        reviewedByTitle: reviewedByTitle || null,
        approvedByName: approvedByName || null,
        approvedByTitle: approvedByTitle || null,
        status: "DRAFT",
        auditors: auditors?.length
          ? {
              create: auditors.map((a: any, i: number) => ({
                name: a.name,
                role: a.role,
                title: a.title || null,
                certifications: a.certifications || [],
                experienceYears: a.experienceYears || null,
                email: a.email || null,
                sortOrder: i,
              })),
            }
          : undefined,
        planItems: planItems?.length
          ? {
              create: planItems.map((p: any, i: number) => ({
                itemNumber: p.itemNumber,
                auditArea: p.auditArea,
                scope: p.scope || null,
                plannedDate: p.plannedDate || null,
                leadAuditorName: p.leadAuditorName,
                duration: p.duration || null,
                status: p.status || "Planlandı",
                auditId: p.auditId || null,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: {
        auditors: true,
        planItems: true,
      },
    })

    return NextResponse.json({
      success: true,
      program,
      message: "Denetim programı oluşturuldu",
    })
  } catch (error) {
    console.error("Denetim programı oluşturma hatası:", error)
    return NextResponse.json(
      { error: "Program oluşturulamadı" },
      { status: 500 }
    )
  }
}
