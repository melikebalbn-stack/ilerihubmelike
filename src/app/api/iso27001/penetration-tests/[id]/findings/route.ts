import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_ROLES = ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"]

// GET - Bulguları listele
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

    const findings = await prisma.iso27001PenTestFinding.findMany({
      where: { testId: id },
      orderBy: [{ severity: "asc" }, { findingNumber: "asc" }],
    })

    return NextResponse.json(findings)
  } catch (error) {
    console.error("Bulgular alınırken hata:", error)
    return NextResponse.json({ error: "Hata oluştu" }, { status: 500 })
  }
}

// POST - Yeni bulgu ekle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const userRole = (session.user as any).role || "EMPLOYEE"
    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Test kontrolü
    const test = await prisma.iso27001PenetrationTest.findUnique({ where: { id } })
    if (!test) {
      return NextResponse.json({ error: "Test bulunamadı" }, { status: 404 })
    }

    // Bulgu numarası oluştur
    const count = await prisma.iso27001PenTestFinding.count({ where: { testId: id } })
    const findingNumber = body.findingNumber || `VLN-${String(count + 1).padStart(3, "0")}`

    const finding = await prisma.iso27001PenTestFinding.create({
      data: {
        testId: id,
        findingNumber,
        severity: body.severity || "MEDIUM",
        title: body.title?.trim() || "",
        category: body.category?.trim() || null,
        description: body.description?.trim() || null,
        impact: body.impact?.trim() || null,
        recommendation: body.recommendation?.trim() || null,
        responsiblePerson: body.responsiblePerson?.trim() || null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        actionStatus: body.actionStatus || "OPEN",
        actionNote: body.actionNote?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, finding }, { status: 201 })
  } catch (error) {
    console.error("Bulgu oluşturulurken hata:", error)
    return NextResponse.json({ error: "Hata oluştu" }, { status: 500 })
  }
}

// PUT - Bulgu güncelle (actionStatus, actionNote vb.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const userRole = (session.user as any).role || "EMPLOYEE"
    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
    }

    const body = await request.json()
    const { findingId } = body

    if (!findingId) {
      return NextResponse.json({ error: "findingId gerekli" }, { status: 400 })
    }

    const existing = await prisma.iso27001PenTestFinding.findUnique({ where: { id: findingId } })
    if (!existing) {
      return NextResponse.json({ error: "Bulgu bulunamadı" }, { status: 404 })
    }

    const updateData: any = {}
    if (body.actionStatus !== undefined) updateData.actionStatus = body.actionStatus
    if (body.actionNote !== undefined) updateData.actionNote = body.actionNote?.trim() || null
    if (body.responsiblePerson !== undefined) updateData.responsiblePerson = body.responsiblePerson?.trim() || null
    if (body.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null
    if (body.severity !== undefined) updateData.severity = body.severity
    if (body.title !== undefined) updateData.title = body.title?.trim() || ""
    if (body.category !== undefined) updateData.category = body.category?.trim() || null
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.impact !== undefined) updateData.impact = body.impact?.trim() || null
    if (body.recommendation !== undefined) updateData.recommendation = body.recommendation?.trim() || null

    if (body.actionStatus === "RESOLVED") {
      updateData.resolvedAt = new Date()
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { name: true },
      })
      updateData.resolvedByName = user?.name || session.user.name
    }

    const finding = await prisma.iso27001PenTestFinding.update({
      where: { id: findingId },
      data: updateData,
    })

    return NextResponse.json({ success: true, finding })
  } catch (error) {
    console.error("Bulgu güncellenirken hata:", error)
    return NextResponse.json({ error: "Hata oluştu" }, { status: 500 })
  }
}
