import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { logAuditEvent } from "@/lib/audit-log"

// Tek doküman detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const document = await prisma.iso27001Document.findUnique({
      where: { id },
      include: {
        signatures: {
          orderBy: { signedAt: "desc" },
        },
        versions: {
          orderBy: { createdAt: "desc" },
        },
        controlLinks: {
          include: {
            control: true,
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Dokuman bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error("Dokuman detay hatasi:", error)
    return NextResponse.json(
      { error: "Dokuman alinamadi" },
      { status: 500 }
    )
  }
}

// Doküman güncelleme
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { session, userId, error } = await requireSession()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const document = await prisma.iso27001Document.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ error: "Dokuman bulunamadi" }, { status: 404 })
    }

    // Güncelleme
    const updated = await prisma.iso27001Document.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        clause: body.clause,
        controlId: body.controlId,
        status: body.status,
        reviewFrequency: body.reviewFrequency,
        nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : undefined,
      },
    })

    // PR-AUDIT-LOG-EXPANSION
    await logAuditEvent({
      action: 'BGYS_DOCUMENT_UPDATED',
      actorId: userId,
      targetType: 'BGYS_DOCUMENT',
      targetId: id,
      details: {
        actorEmail: session.user.email,
        documentNumber: document.documentNumber,
        before: {
          title: document.title,
          category: document.category,
          status: document.status,
        },
        after: {
          title: updated.title,
          category: updated.category,
          status: updated.status,
        },
      },
    })

    return NextResponse.json({
      success: true,
      document: updated,
      message: "Dokuman guncellendi",
    })
  } catch (error) {
    console.error("Dokuman guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Dokuman guncellenemedi" },
      { status: 500 }
    )
  }
}

// Doküman silme (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { session, userId, error } = await requireSession()
    if (error) return error

    const { id } = await params

    const document = await prisma.iso27001Document.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ error: "Dokuman bulunamadi" }, { status: 404 })
    }

    // Soft delete
    await prisma.iso27001Document.update({
      where: { id },
      data: {
        isActive: false,
        status: "ARCHIVED",
      },
    })

    // PR-AUDIT-LOG-EXPANSION (soft delete = ARCHIVED)
    await logAuditEvent({
      action: 'BGYS_DOCUMENT_DELETED',
      actorId: userId,
      targetType: 'BGYS_DOCUMENT',
      targetId: id,
      details: {
        actorEmail: session.user.email,
        documentNumber: document.documentNumber,
        title: document.title,
        category: document.category,
        version: document.version,
        softDelete: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Dokuman silindi",
    })
  } catch (error) {
    console.error("Dokuman silme hatasi:", error)
    return NextResponse.json(
      { error: "Dokuman silinemedi" },
      { status: 500 }
    )
  }
}
