import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { requireBgysSorumlu } from "@/lib/permissions/bgys"

// GET - Tek test detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireSession (read-only detay)
    const { error } = await requireSession()
    if (error) return error

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
    // PR-Y2.5-iso27001-C: requireBgysSorumlu (admin CRUD; APPROVED durumunda approvedBy = user)
    const { user, error } = await requireBgysSorumlu()
    if (error) return error

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
        updateData.approvedById = user.id
        updateData.approvedByName = user.name || user.email
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
    // PR-Y2.5-iso27001-C: requireBgysSorumlu (admin CRUD)
    const { error } = await requireBgysSorumlu()
    if (error) return error

    const { id } = await params

    await prisma.iso27001PenetrationTest.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Sızma testi silinirken hata:", error)
    return NextResponse.json({ error: "Hata oluştu" }, { status: 500 })
  }
}
