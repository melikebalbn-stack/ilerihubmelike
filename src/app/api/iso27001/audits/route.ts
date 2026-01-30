import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Denetim listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const auditType = searchParams.get("type")
    const year = searchParams.get("year")
    const search = searchParams.get("search")

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (auditType) {
      where.auditType = auditType
    }

    if (year) {
      const yearNum = parseInt(year)
      where.plannedDate = {
        gte: new Date(yearNum, 0, 1),
        lt: new Date(yearNum + 1, 0, 1),
      }
    }

    if (search) {
      where.OR = [
        { auditNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { leadAuditorName: { contains: search, mode: "insensitive" } },
        { auditeeDepartment: { contains: search, mode: "insensitive" } },
      ]
    }

    // Performans: Liste için sadece gerekli alanları çek
    const audits = await prisma.iso27001Audit.findMany({
      where,
      orderBy: [{ plannedDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        auditNumber: true,
        title: true,
        description: true,
        auditType: true,
        plannedDate: true,
        startDate: true,
        endDate: true,
        leadAuditorName: true,
        leadAuditorEmail: true,
        auditeeName: true,
        auditeeDepartment: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            teamMembers: true,
            findings: true,
          },
        },
      },
    })

    return NextResponse.json(audits)
  } catch (error) {
    console.error("Denetim listesi hatasi:", error)
    return NextResponse.json(
      { error: "Denetimler alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni denetim oluştur
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
      auditType,
      scope,
      clauses,
      controls,
      plannedDate,
      leadAuditorId,
      leadAuditorName,
      leadAuditorEmail,
      auditeeId,
      auditeeName,
      auditeeEmail,
      auditeeDepartment,
      teamMembers,
    } = body

    if (!title || !auditType || !plannedDate || !leadAuditorName || !leadAuditorEmail) {
      return NextResponse.json(
        { error: "Baslik, denetim tipi, planlanan tarih ve lider denetci bilgileri zorunludur" },
        { status: 400 }
      )
    }

    // Denetim numarası oluştur: ISO-AUD-YYYY-XXXX
    const year = new Date().getFullYear()
    const lastAudit = await prisma.iso27001Audit.findFirst({
      where: {
        auditNumber: {
          startsWith: `ISO-AUD-${year}`,
        },
      },
      orderBy: { auditNumber: "desc" },
      select: { auditNumber: true },
    })

    let nextNum = 1
    if (lastAudit) {
      const lastNum = parseInt(lastAudit.auditNumber.split("-")[3])
      nextNum = lastNum + 1
    }
    const auditNumber = `ISO-AUD-${year}-${String(nextNum).padStart(4, "0")}`

    const audit = await prisma.iso27001Audit.create({
      data: {
        auditNumber,
        title,
        description,
        auditType,
        scope,
        clauses: clauses || [],
        controls: controls || [],
        plannedDate: new Date(plannedDate),
        leadAuditorId: leadAuditorId || null,
        leadAuditorName,
        leadAuditorEmail,
        auditeeId: auditeeId || null,
        auditeeName: auditeeName || null,
        auditeeEmail: auditeeEmail || null,
        auditeeDepartment: auditeeDepartment || null,
        status: "PLANNED",
        teamMembers: teamMembers?.length
          ? {
              create: teamMembers.map((member: any) => ({
                memberId: member.memberId || "",
                memberName: member.memberName,
                memberEmail: member.memberEmail,
                role: member.role || "Denetci",
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        auditNumber: true,
        title: true,
        status: true,
      },
    })

    return NextResponse.json({
      success: true,
      audit,
      message: "Denetim olusturuldu",
    })
  } catch (error) {
    console.error("Denetim olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Denetim olusturulamadi" },
      { status: 500 }
    )
  }
}

// Hızlı istatistikler
export async function HEAD() {
  try {
    const [total, planned, inProgress] = await Promise.all([
      prisma.iso27001Audit.count(),
      prisma.iso27001Audit.count({ where: { status: "PLANNED" } }),
      prisma.iso27001Audit.count({ where: { status: "IN_PROGRESS" } }),
    ])
    return new NextResponse(null, {
      status: 200,
      headers: {
        "X-Audit-Count": total.toString(),
        "X-Planned-Count": planned.toString(),
        "X-InProgress-Count": inProgress.toString(),
      },
    })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}
