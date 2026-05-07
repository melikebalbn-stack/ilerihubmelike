import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// GET - Değişiklik taleplerini listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (userId JWT'de mevcut)
    const { userId, error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    const where: any = {}

    if (search) {
      where.OR = [
        { changeNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    const changes = await prisma.qdmsChangeRequest.findMany({
      where,
      include: {
        requester: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Map to frontend expected format
    const result = changes.map(change => ({
      ...change,
      requestor: change.requester,
      requestDate: change.createdAt,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Değişiklik listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni değişiklik talebi oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (userId JWT'de mevcut)
    const { userId, error } = await requireSession()
    if (error) return error

    const body = await request.json()
    const { title, type, priority, description, departmentId } = body

    // Validasyon
    if (!title || !type) {
      return NextResponse.json(
        { message: "Başlık ve tür zorunludur" },
        { status: 400 }
      )
    }

    // Değişiklik numarası oluştur
    const year = new Date().getFullYear()
    const count = await prisma.qdmsChangeRequest.count({
      where: {
        changeNumber: { startsWith: `CR-${year}` },
      },
    })
    const changeNumber = `CR-${year}-${String(count + 1).padStart(3, "0")}`

    const change = await prisma.qdmsChangeRequest.create({
      data: {
        changeNumber,
        title,
        type,
        priority: priority || "MEDIUM",
        description: description || "",
        status: "DRAFT",
        requesterId: userId,
        departmentId: departmentId || null,
      },
      include: {
        requester: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    })

    // Map to frontend expected format
    const result = {
      ...change,
      requestor: change.requester,
      requestDate: change.createdAt,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Değişiklik oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
