import { NextRequest, NextResponse } from "next/server"
import { qdmsAccessResult } from "@/lib/auth/qdms-access"
import { prisma } from "@/lib/prisma"

// GET - Denetimleri listele
export async function GET(request: NextRequest) {
  try {
    // QDMS-RBAC: qdmsAccessResult (kalite ekibi/admin VEYA qdms.view|manage)
    const { error } = await qdmsAccessResult('view')
    if (error) return error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    const where: any = {}

    if (search) {
      where.OR = [
        { auditNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { standard: { contains: search, mode: "insensitive" } },
      ]
    }

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    const audits = await prisma.qdmsAudit.findMany({
      where,
      include: {
        leadAuditor: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { plannedDate: "desc" },
    })

    return NextResponse.json(audits)
  } catch (error) {
    console.error("Denetim listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni denetim oluştur
export async function POST(request: NextRequest) {
  try {
    // QDMS-RBAC: qdmsAccessResult (kalite ekibi/admin VEYA qdms.view|manage)
    const { userId, error } = await qdmsAccessResult('manage')
    if (error) return error

    const body = await request.json()
    const { title, type, standard, plannedDate, scope, description, departmentId } = body

    // Validasyon
    if (!title || !type || !plannedDate) {
      return NextResponse.json(
        { message: "Başlık, tür ve planlanan tarih zorunludur" },
        { status: 400 }
      )
    }

    // Denetim numarası oluştur (AUD-YYYY-XXX formatında)
    const year = new Date().getFullYear()
    const count = await prisma.qdmsAudit.count({
      where: {
        auditNumber: { startsWith: `AUD-${year}` },
      },
    })
    const auditNumber = `AUD-${year}-${String(count + 1).padStart(3, "0")}`

    // departmentId boş string ise null yap
    const validDepartmentId = departmentId && departmentId.trim() !== "" ? departmentId : null

    const audit = await prisma.qdmsAudit.create({
      data: {
        auditNumber,
        title,
        type,
        standard: standard || null,
        plannedDate: new Date(plannedDate),
        scope: scope || null,
        description: description || null,
        status: "PLANNED",
        leadAuditorId: userId,
        departmentId: validDepartmentId,
      },
      include: {
        leadAuditor: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(audit, { status: 201 })
  } catch (error) {
    console.error("Denetim oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
