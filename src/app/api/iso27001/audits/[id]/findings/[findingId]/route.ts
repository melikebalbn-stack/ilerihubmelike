import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Tek bulgu detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id, findingId } = await params

    const finding = await prisma.iso27001AuditFinding.findFirst({
      where: {
        id: findingId,
        auditId: id,
      },
      include: {
        audit: {
          select: {
            id: true,
            auditNumber: true,
            title: true,
          },
        },
        control: {
          select: {
            id: true,
            controlId: true,
            title: true,
            titleTr: true,
          },
        },
      },
    })

    if (!finding) {
      return NextResponse.json({ error: "Bulgu bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(finding)
  } catch (error) {
    console.error("Bulgu detay hatasi:", error)
    return NextResponse.json(
      { error: "Bulgu alinamadi" },
      { status: 500 }
    )
  }
}

// Bulgu güncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id, findingId } = await params
    const body = await request.json()

    // Mevcut bulguyu kontrol et
    const existing = await prisma.iso27001AuditFinding.findFirst({
      where: {
        id: findingId,
        auditId: id,
      },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Bulgu bulunamadi" }, { status: 404 })
    }

    const {
      findingType,
      title,
      description,
      evidence,
      severity,
      controlId,
      clause,
      correctiveAction,
      responsibleId,
      responsibleName,
      dueDate,
      completedDate,
      verifiedById,
      verifiedByName,
      verificationNotes,
      status,
    } = body

    // Sadece değişen alanları güncelle
    const updateData: any = {}
    if (findingType !== undefined) updateData.findingType = findingType
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (evidence !== undefined) updateData.evidence = evidence || null
    if (severity !== undefined) updateData.severity = severity
    if (controlId !== undefined) updateData.controlId = controlId || null
    if (clause !== undefined) updateData.clause = clause || null
    if (correctiveAction !== undefined) updateData.correctiveAction = correctiveAction || null
    if (responsibleId !== undefined) updateData.responsibleId = responsibleId || null
    if (responsibleName !== undefined) updateData.responsibleName = responsibleName || null
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (completedDate !== undefined) updateData.completedDate = completedDate ? new Date(completedDate) : null
    if (status !== undefined) updateData.status = status

    // Doğrulama bilgileri
    if (verifiedById !== undefined) updateData.verifiedById = verifiedById || null
    if (verifiedByName !== undefined) updateData.verifiedByName = verifiedByName || null
    if (verificationNotes !== undefined) updateData.verificationNotes = verificationNotes || null

    // Eğer doğrulama yapılıyorsa tarihi de güncelle
    if (verifiedById !== undefined && verifiedById) {
      updateData.verifiedAt = new Date()
    }

    // Eğer status CLOSED yapılıyorsa ve completedDate yoksa otomatik ata
    if (status === "CLOSED" && !updateData.completedDate && existing.status !== "CLOSED") {
      updateData.completedDate = new Date()
    }

    const finding = await prisma.iso27001AuditFinding.update({
      where: { id: findingId },
      data: updateData,
      select: {
        id: true,
        findingNumber: true,
        title: true,
        status: true,
      },
    })

    return NextResponse.json({
      success: true,
      finding,
      message: "Bulgu guncellendi",
    })
  } catch (error) {
    console.error("Bulgu guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Bulgu guncellenemedi" },
      { status: 500 }
    )
  }
}

// Bulgu sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id, findingId } = await params

    // Mevcut bulguyu kontrol et
    const existing = await prisma.iso27001AuditFinding.findFirst({
      where: {
        id: findingId,
        auditId: id,
      },
      select: { id: true, findingNumber: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Bulgu bulunamadi" }, { status: 404 })
    }

    await prisma.iso27001AuditFinding.delete({
      where: { id: findingId },
    })

    return NextResponse.json({
      success: true,
      message: `${existing.findingNumber} numarali bulgu silindi`,
    })
  } catch (error) {
    console.error("Bulgu silme hatasi:", error)
    return NextResponse.json(
      { error: "Bulgu silinemedi" },
      { status: 500 }
    )
  }
}
