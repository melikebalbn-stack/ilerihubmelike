import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Kontrole bağlı dokümanları getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    // Kontrolü bul (controlId veya id olabilir)
    const control = await prisma.iso27001Control.findFirst({
      where: {
        OR: [{ id }, { controlId: id }],
      },
      select: {
        id: true,
        controlId: true,
        documents: {
          include: {
            document: {
              select: {
                id: true,
                documentNumber: true,
                title: true,
                category: true,
                status: true,
              },
            },
          },
        },
      },
    })

    if (!control) {
      return NextResponse.json({ error: "Kontrol bulunamadi" }, { status: 404 })
    }

    return NextResponse.json({
      controlId: control.controlId,
      documents: control.documents.map((d) => ({
        id: d.document.id,
        documentNumber: d.document.documentNumber,
        title: d.document.title,
        category: d.document.category,
        status: d.document.status,
        relationshipType: d.relationshipType,
      })),
    })
  } catch (error) {
    console.error("Kontrol dokumanlari hatasi:", error)
    return NextResponse.json(
      { error: "Dokumanlar alinamadi" },
      { status: 500 }
    )
  }
}

// Kontrole doküman bağla/güncelle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const { documentIds } = body

    if (!Array.isArray(documentIds)) {
      return NextResponse.json({ error: "documentIds array olmali" }, { status: 400 })
    }

    // Kontrolü bul
    const control = await prisma.iso27001Control.findFirst({
      where: {
        OR: [{ id }, { controlId: id }],
      },
      select: { id: true, controlId: true },
    })

    if (!control) {
      return NextResponse.json({ error: "Kontrol bulunamadi" }, { status: 404 })
    }

    // Mevcut bağlantıları sil
    await prisma.iso27001ControlDocument.deleteMany({
      where: { controlId: control.id },
    })

    // Yeni bağlantıları oluştur
    if (documentIds.length > 0) {
      await prisma.iso27001ControlDocument.createMany({
        data: documentIds.map((docId: string) => ({
          controlId: control.id,
          documentId: docId,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({
      success: true,
      message: `${documentIds.length} dokuman baglandi`,
    })
  } catch (error) {
    console.error("Dokuman baglama hatasi:", error)
    return NextResponse.json(
      { error: "Dokumanlar baglanamadi" },
      { status: 500 }
    )
  }
}
