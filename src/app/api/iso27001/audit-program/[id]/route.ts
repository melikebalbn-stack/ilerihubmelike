import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { requireBgysSorumlu } from "@/lib/permissions/bgys"

// Tek program detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireSession (read-only detay)
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const program = await prisma.iso27001AuditProgram.findUnique({
      where: { id },
      include: {
        auditors: {
          orderBy: { sortOrder: "asc" },
        },
        planItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    if (!program) {
      return NextResponse.json({ error: "Program bulunamadı" }, { status: 404 })
    }

    return NextResponse.json(program)
  } catch (error) {
    console.error("Program detay hatası:", error)
    return NextResponse.json(
      { error: "Program alınamadı" },
      { status: 500 }
    )
  }
}

// Program güncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireBgysSorumlu (admin CRUD; ALLOWED_ROLES helper'a tasindi)
    const { error } = await requireBgysSorumlu()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.iso27001AuditProgram.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Program bulunamadı" }, { status: 404 })
    }

    const {
      title,
      revision,
      publishDate,
      periodLabel,
      purpose,
      auditApproach,
      status,
      preparedByName,
      preparedByTitle,
      reviewedByName,
      reviewedByTitle,
      reviewedAt,
      approvedByName,
      approvedByTitle,
      approvedAt,
    } = body

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (revision !== undefined) updateData.revision = revision
    if (publishDate !== undefined) updateData.publishDate = new Date(publishDate)
    if (periodLabel !== undefined) updateData.periodLabel = periodLabel
    if (purpose !== undefined) updateData.purpose = purpose
    if (auditApproach !== undefined) updateData.auditApproach = auditApproach
    if (status !== undefined) updateData.status = status
    if (preparedByName !== undefined) updateData.preparedByName = preparedByName
    if (preparedByTitle !== undefined) updateData.preparedByTitle = preparedByTitle
    if (reviewedByName !== undefined) updateData.reviewedByName = reviewedByName
    if (reviewedByTitle !== undefined) updateData.reviewedByTitle = reviewedByTitle
    if (reviewedAt !== undefined) updateData.reviewedAt = reviewedAt ? new Date(reviewedAt) : null
    if (approvedByName !== undefined) updateData.approvedByName = approvedByName
    if (approvedByTitle !== undefined) updateData.approvedByTitle = approvedByTitle
    if (approvedAt !== undefined) updateData.approvedAt = approvedAt ? new Date(approvedAt) : null

    const program = await prisma.iso27001AuditProgram.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        programNumber: true,
        title: true,
        status: true,
      },
    })

    return NextResponse.json({
      success: true,
      program,
      message: "Program güncellendi",
    })
  } catch (error) {
    console.error("Program güncelleme hatası:", error)
    return NextResponse.json(
      { error: "Program güncellenemedi" },
      { status: 500 }
    )
  }
}

// Program sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireBgysSorumlu (admin CRUD; ALLOWED_ROLES helper'a tasindi)
    const { error } = await requireBgysSorumlu()
    if (error) return error

    const { id } = await params

    const existing = await prisma.iso27001AuditProgram.findUnique({
      where: { id },
      select: { id: true, programNumber: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Program bulunamadı" }, { status: 404 })
    }

    await prisma.iso27001AuditProgram.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `${existing.programNumber} numaralı program silindi`,
    })
  } catch (error) {
    console.error("Program silme hatası:", error)
    return NextResponse.json(
      { error: "Program silinemedi" },
      { status: 500 }
    )
  }
}
