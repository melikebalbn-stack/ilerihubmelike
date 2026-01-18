import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Tek doküman getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { id } = await params

    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
        revisions: {
          include: {
            revisedBy: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error("Doküman getirme hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// PATCH - Doküman güncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // Sadece taslak veya reddedilen dokümanlar düzenlenebilir
    if (!["DRAFT", "PENDING_REVIEW"].includes(document.status)) {
      return NextResponse.json(
        { message: "Bu durumda doküman düzenlenemez" },
        { status: 400 }
      )
    }

    const { title, description, category, departmentId } = body

    const updated = await prisma.qdmsDocument.update({
      where: { id },
      data: {
        title,
        description,
        category,
        departmentId: departmentId || null,
      },
      include: {
        owner: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Doküman güncelleme hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// DELETE - Doküman sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { id } = await params

    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // Sadece taslak dokümanlar silinebilir
    if (document.status !== "DRAFT") {
      return NextResponse.json(
        { message: "Sadece taslak dokümanlar silinebilir" },
        { status: 400 }
      )
    }

    await prisma.qdmsDocument.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Doküman silindi" })
  } catch (error) {
    console.error("Doküman silme hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
