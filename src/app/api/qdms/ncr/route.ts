import { NextRequest, NextResponse } from "next/server"
import { qdmsAccessResult } from "@/lib/auth/qdms-access"
import { prisma } from "@/lib/prisma"

// GET - NCR'leri listele
export async function GET(request: NextRequest) {
  try {
    // QDMS-RBAC: qdmsAccessResult (kalite ekibi/admin VEYA qdms.view|manage)
    const { userId, error } = await qdmsAccessResult('view')
    if (error) return error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const source = searchParams.get("source")
    const status = searchParams.get("status")
    const departmentId = searchParams.get("departmentId")

    const where: any = {}

    if (search) {
      where.OR = [
        { ncrNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { productId: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { workOrderNo: { contains: search, mode: "insensitive" } },
      ]
    }

    if (source) {
      where.category = source
    }

    if (status) {
      where.status = status
    }

    if (departmentId) {
      where.departmentId = departmentId
    }

    const ncrs = await prisma.qdmsNonConformance.findMany({
      where,
      include: {
        detectedBy: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
        causedByDepartment: {
          select: { id: true, name: true },
        },
        actionResponsible: {
          select: { id: true, name: true },
        },
        actionApprover: {
          select: { id: true, name: true },
        },
        participants: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { detectedAt: "desc" },
    })

    // Map to frontend expected format
    const result = ncrs.map(ncr => ({
      ...ncr,
      reportedBy: ncr.detectedBy,
      detectedDate: ncr.detectedAt,
      source: ncr.category,
      severity: ncr.level,
      productCode: ncr.productId,
      lotNumber: ncr.batchNumber,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("NCR listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni NCR oluştur
export async function POST(request: NextRequest) {
  try {
    // QDMS-RBAC: qdmsAccessResult (kalite ekibi/admin VEYA qdms.view|manage)
    const { userId, error } = await qdmsAccessResult('manage')
    if (error) return error

    const body = await request.json()
    const {
      title, source, severity, description, quantity, productCode, lotNumber, departmentId,
      subPartCode, customerName, workOrderNo, workOrderQuantity, reworkQuantity, scrapQuantity,
      causedByDepartmentId, rootCauseOccurrence, rootCauseEscape, interimAction, permanentAction,
      plannedActionDate, actionCompletionDate, actionResponsibleId, actionApproverId,
      participantIds, lessonsLearned,
    } = body

    // Validasyon
    if (!title || !source) {
      return NextResponse.json(
        { message: "Başlık ve kaynak zorunludur" },
        { status: 400 }
      )
    }

    // NCR numarası oluştur
    const year = new Date().getFullYear()
    const count = await prisma.qdmsNonConformance.count({
      where: {
        ncrNumber: { startsWith: `NCR-${year}` },
      },
    })
    const ncrNumber = `NCR-${year}-${String(count + 1).padStart(3, "0")}`

    // Map severity to level enum
    const levelMap: Record<string, string> = {
      MINOR: "MINOR",
      MAJOR: "MAJOR",
      CRITICAL: "CRITICAL",
    }

    const toInt = (v: unknown) => {
      const n = parseInt(String(v), 10)
      return Number.isFinite(n) ? n : null
    }
    const toDate = (v: unknown) => (v ? new Date(String(v)) : null)

    const ncr = await prisma.qdmsNonConformance.create({
      data: {
        ncrNumber,
        title,
        category: source,
        level: (levelMap[severity] || "MINOR") as any,
        description: description || "",
        quantity: quantity || 1,
        productId: productCode || null,
        batchNumber: lotNumber || null,
        status: "OPEN",
        detectedAt: new Date(),
        detectedById: userId,
        departmentId: departmentId || null,
        subPartCode: subPartCode || null,
        customerName: customerName || null,
        workOrderNo: workOrderNo || null,
        workOrderQuantity: toInt(workOrderQuantity),
        reworkQuantity: toInt(reworkQuantity),
        scrapQuantity: toInt(scrapQuantity),
        causedByDepartmentId: causedByDepartmentId || null,
        rootCauseOccurrence: rootCauseOccurrence || null,
        rootCauseEscape: rootCauseEscape || null,
        interimAction: interimAction || null,
        permanentAction: permanentAction || null,
        plannedActionDate: toDate(plannedActionDate),
        actionCompletionDate: toDate(actionCompletionDate),
        actionResponsibleId: actionResponsibleId || null,
        actionApproverId: actionApproverId || null,
        lessonsLearned: Array.isArray(lessonsLearned) ? lessonsLearned : [],
        participants: Array.isArray(participantIds) && participantIds.length > 0
          ? { create: participantIds.map((participantId: string) => ({ userId: participantId })) }
          : undefined,
      },
      include: {
        detectedBy: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
        causedByDepartment: {
          select: { id: true, name: true },
        },
        actionResponsible: {
          select: { id: true, name: true },
        },
        actionApprover: {
          select: { id: true, name: true },
        },
        participants: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    })

    // Map to frontend expected format
    const result = {
      ...ncr,
      reportedBy: ncr.detectedBy,
      detectedDate: ncr.detectedAt,
      source: ncr.category,
      severity: ncr.level,
      productCode: ncr.productId,
      lotNumber: ncr.batchNumber,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("NCR oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
