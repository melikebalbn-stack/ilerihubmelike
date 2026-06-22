import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { requireUser } from "@/lib/auth/require-user"

// PR-OWNERSHIP-AUDIT: Doküman düzenleme/silme için owner veya QM yetkisi
const QM_ROLES = ["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"] as const

// GET - Tek doküman getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-qdms: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

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
    // PR-OWNERSHIP-AUDIT: requireUser — owner ID karşılaştırması için
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // PR-OWNERSHIP-AUDIT: Sadece doküman sahibi (Hazırlayan) veya Kalite Yöneticisi düzenleyebilir
    const isOwner = document.ownerId === user.id
    const isQM = QM_ROLES.includes(user.role as typeof QM_ROLES[number])
    if (!isOwner && !isQM) {
      return NextResponse.json(
        { message: "Bu dokümanı düzenleme yetkiniz yok. Sadece dokümanı hazırlayan kişi veya Kalite Yöneticisi düzenleyebilir." },
        { status: 403 }
      )
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
    // PR-OWNERSHIP-AUDIT: requireUser — owner ID karşılaştırması için
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // PR-OWNERSHIP-AUDIT: Sadece doküman sahibi (Hazırlayan) veya Kalite Yöneticisi silebilir
    const isOwner = document.ownerId === user.id
    const isQM = QM_ROLES.includes(user.role as typeof QM_ROLES[number])
    if (!isOwner && !isQM) {
      return NextResponse.json(
        { message: "Bu dokümanı silme yetkiniz yok. Sadece dokümanı hazırlayan kişi veya Kalite Yöneticisi silebilir." },
        { status: 403 }
      )
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
