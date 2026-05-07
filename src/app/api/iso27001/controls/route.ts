import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Kontrol listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const where: any = {}

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { controlId: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { titleTr: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    // Performans: Sadece gerekli alanları çek
    const controls = await prisma.iso27001Control.findMany({
      where,
      orderBy: [
        { categoryNumber: "asc" },
        { controlNumber: "asc" },
      ],
      select: {
        id: true,
        controlId: true,
        title: true,
        titleTr: true,
        description: true,
        descriptionTr: true,
        category: true,
        categoryNumber: true,
        controlNumber: true,
        status: true,
        applicability: true,
        justification: true,
        implementationNotes: true,
        implementationDate: true,
        controlSource: true,
        relatedAssets: true,
        responsibleName: true,
        responsibleEmail: true,
        lastReviewDate: true,
        nextReviewDate: true,
        _count: {
          select: {
            documents: true,
            evidences: true,
          },
        },
      },
    })

    return NextResponse.json(controls)
  } catch (error) {
    console.error("Kontrol listesi hatasi:", error)
    return NextResponse.json(
      { error: "Kontroller alinamadi" },
      { status: 500 }
    )
  }
}

// Kontrol güncelleme
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const body = await request.json()
    const { controlId, status, applicability, justification, implementationNotes, controlSource, relatedAssets, responsibleName, responsibleEmail } = body

    if (!controlId) {
      return NextResponse.json({ error: "Kontrol ID zorunludur" }, { status: 400 })
    }

    // Mevcut kontrolü kontrol et
    const existing = await prisma.iso27001Control.findUnique({
      where: { controlId },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Kontrol bulunamadi" }, { status: 404 })
    }

    // Sadece değişen alanları güncelle
    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (applicability !== undefined) updateData.applicability = applicability
    if (justification !== undefined) updateData.justification = justification || null
    if (implementationNotes !== undefined) updateData.implementationNotes = implementationNotes || null
    if (controlSource !== undefined) updateData.controlSource = controlSource || null
    if (relatedAssets !== undefined) updateData.relatedAssets = relatedAssets || null
    if (responsibleName !== undefined) updateData.responsibleName = responsibleName || null
    // PR-Y2.5: input boundary normalization — DB email lowercase invariant
    if (responsibleEmail !== undefined) {
      updateData.responsibleEmail = typeof responsibleEmail === 'string' && responsibleEmail.trim() !== ''
        ? responsibleEmail.toLowerCase()
        : null
    }

    // Uygulama tarihi - sadece yeni IMPLEMENTED/EFFECTIVE olduğunda
    if ((status === "IMPLEMENTED" || status === "EFFECTIVE") &&
        existing.status !== "IMPLEMENTED" && existing.status !== "EFFECTIVE") {
      updateData.implementationDate = new Date()
    }

    const control = await prisma.iso27001Control.update({
      where: { controlId },
      data: updateData,
      select: {
        id: true,
        controlId: true,
        status: true,
        implementationDate: true,
      },
    })

    return NextResponse.json({
      success: true,
      control,
      message: "Kontrol guncellendi",
    })
  } catch (error) {
    console.error("Kontrol guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Kontrol guncellenemedi" },
      { status: 500 }
    )
  }
}

// İstatistikler için hızlı endpoint
export async function HEAD() {
  try {
    const count = await prisma.iso27001Control.count()
    return new NextResponse(null, {
      status: 200,
      headers: { "X-Control-Count": count.toString() },
    })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}
