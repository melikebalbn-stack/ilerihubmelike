import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_ROLES = ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"]

// GET - Tek test detayı
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

    const test = await prisma.iso27001PenetrationTest.findUnique({
      where: { id },
      include: {
        signatures: {
          orderBy: { signedAt: "desc" },
        },
        findings: {
          orderBy: [{ severity: "asc" }, { findingNumber: "asc" }],
        },
      },
    })

    if (!test) {
      return NextResponse.json({ error: "Test bulunamadı" }, { status: 404 })
    }

    return NextResponse.json(test)
  } catch (error) {
    console.error("Sızma testi alınırken hata:", error)
    return NextResponse.json({ error: "Hata oluştu" }, { status: 500 })
  }
}

// PUT - Test güncelle
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

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.iso27001PenetrationTest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Test bulunamadı" }, { status: 404 })
    }

    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.testDate !== undefined) updateData.testDate = new Date(body.testDate)
    if (body.testType !== undefined) updateData.testType = body.testType
    if (body.scope !== undefined) updateData.scope = body.scope?.trim() || null
    if (body.methodology !== undefined) updateData.methodology = body.methodology?.trim() || null
    if (body.tester !== undefined) updateData.tester = body.tester?.trim() || ""
    if (body.criticalCount !== undefined) updateData.criticalCount = parseInt(body.criticalCount) || 0
    if (body.highCount !== undefined) updateData.highCount = parseInt(body.highCount) || 0
    if (body.mediumCount !== undefined) updateData.mediumCount = parseInt(body.mediumCount) || 0
    if (body.lowCount !== undefined) updateData.lowCount = parseInt(body.lowCount) || 0
    if (body.infoCount !== undefined) updateData.infoCount = parseInt(body.infoCount) || 0
    if (body.reportFileName !== undefined) updateData.reportFileName = body.reportFileName
    if (body.reportFileUrl !== undefined) updateData.reportFileUrl = body.reportFileUrl
    if (body.reportFileSize !== undefined) updateData.reportFileSize = body.reportFileSize ? parseInt(body.reportFileSize) : null
    if (body.status !== undefined) {
      updateData.status = body.status
      if (body.status === "APPROVED") {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, name: true },
        })
        updateData.approvedById = user?.id
        updateData.approvedByName = user?.name || session.user.name
        updateData.approvedAt = new Date()
      }
    }

    const test = await prisma.iso27001PenetrationTest.update({
      where: { id },
      data: updateData,
      include: { signatures: true },
    })

    return NextResponse.json({ success: true, test })
  } catch (error) {
    console.error("Sızma testi güncellenirken hata:", error)
    return NextResponse.json({ error: "Hata oluştu" }, { status: 500 })
  }
}

// DELETE - Test sil
export async function DELETE(
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

    await prisma.iso27001PenetrationTest.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Sızma testi silinirken hata:", error)
    return NextResponse.json({ error: "Hata oluştu" }, { status: 500 })
  }
}
