import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth/require-user"
import { logAuditEvent } from "@/lib/audit-log"

// Doküman onaylama
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireUser — DB user gerek (approvedBy)
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const document = await prisma.iso27001Document.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ error: "Dokuman bulunamadi" }, { status: 404 })
    }

    if (document.status !== "PENDING_APPROVAL" && document.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Bu dokuman onay bekleyen durumda degil" },
        { status: 400 }
      )
    }

    // Dokümanı onayla
    const updated = await prisma.iso27001Document.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedByName: user.name || user.email,
        approvedAt: new Date(),
      },
    })

    // PR-AUDIT-LOG-EXPANSION: ISO 27001 denetim için onay zorunlu izlenir
    await logAuditEvent({
      action: 'BGYS_DOCUMENT_APPROVED',
      actorId: user.id,
      targetType: 'BGYS_DOCUMENT',
      targetId: id,
      details: {
        actorEmail: user.email,
        documentNumber: document.documentNumber,
        title: document.title,
        version: document.version,
        previousStatus: document.status,
      },
    })

    return NextResponse.json({
      success: true,
      document: updated,
      message: "Dokuman onaylandi",
    })
  } catch (error) {
    console.error("Dokuman onaylama hatasi:", error)
    return NextResponse.json(
      { error: "Dokuman onaylanamadi" },
      { status: 500 }
    )
  }
}
