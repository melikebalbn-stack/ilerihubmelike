import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// GET - CAPA listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (userId JWT'de mevcut, DB lookup gereksiz)
    const { userId, error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")

    const where: any = {}

    if (search) {
      where.OR = [
        { capaNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (type) where.type = type
    if (status) where.status = status
    if (priority) where.priority = priority

    const capas = await prisma.qdmsCapa.findMany({
      where,
      include: {
        initiator: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(capas)
  } catch (error) {
    console.error("CAPA listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni CAPA oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (userId JWT'de mevcut, DB lookup gereksiz)
    const { userId, error } = await requireSession()
    if (error) return error

    const body = await request.json()
    const {
      title,
      description,
      type,
      priority,
      sourceType,
      sourceReference,
      responsibleId,
      departmentId,
      dueDate,
    } = body

    if (!title || !description || !type || !priority || !responsibleId) {
      return NextResponse.json(
        { message: "Başlık, açıklama, tür, öncelik ve sorumlu zorunludur" },
        { status: 400 }
      )
    }

    // CAPA numarası oluştur
    const year = new Date().getFullYear()
    const count = await prisma.qdmsCapa.count({
      where: {
        capaNumber: { startsWith: `CAPA-${year}` },
      },
    })
    const capaNumber = `CAPA-${year}-${String(count + 1).padStart(3, "0")}`

    const capa = await prisma.qdmsCapa.create({
      data: {
        capaNumber,
        title,
        description,
        type,
        priority,
        sourceType: sourceType || "OTHER",
        sourceReference,
        responsibleId,
        departmentId: departmentId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        initiatorId: userId,
        status: "OPEN",
      },
      include: {
        initiator: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(capa, { status: 201 })
  } catch (error) {
    console.error("CAPA oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
