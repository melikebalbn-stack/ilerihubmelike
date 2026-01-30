import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Tek doküman detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

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
